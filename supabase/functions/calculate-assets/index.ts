import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Asset {
  id: string;
  ticker: string;
  quantidade: number;
  preco_medio: number;
  setor?: string;
  corretora: string;
}

interface YahooQuoteResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        symbol: string;
      };
    }>;
    error: null | { description: string };
  };
}

// Cache simples em memória com TTL de 5 minutos
const cache = new Map<string, { preco_atual: number; dividend_yield: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (dados reais devem ser atualizados frequentemente)

function normalizeTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().trim();
  return upperTicker.endsWith(".SA") ? upperTicker : `${upperTicker}.SA`;
}

async function getYahooData(ticker: string): Promise<{ preco_atual: number; dividend_yield: number }> {
  const normalizedTicker = normalizeTicker(ticker);

  // Cache curto para evitar excesso de chamadas (preço + DY TTM)
  const cached = cache.get(normalizedTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { preco_atual: cached.preco_atual, dividend_yield: cached.dividend_yield };
  }

  // Usa somente o endpoint de chart com events=div (quoteSummary vem 401 para dividendos)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=2y&events=div`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!resp.ok) throw new Error(`Falha ao buscar chart ${resp.status} para ${normalizedTicker}`);

  const data = await resp.json();
  const chart = data?.chart?.result?.[0];
  if (!chart) throw new Error(`Chart vazio para ${normalizedTicker}`);

  const preco_atual = chart?.meta?.regularMarketPrice;
  if (typeof preco_atual !== 'number' || preco_atual <= 0) {
    throw new Error(`Preço inválido para ${normalizedTicker}`);
  }

  // Soma dividendos dos últimos 12 meses (TTM) a partir dos eventos de dividends
  const events = chart?.events?.dividends ?? {};
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let sumTTM = 0;
  for (const key in events) {
    const evt = events[key];
    const tsMs = (evt?.date ?? 0) * 1000;
    if (tsMs >= oneYearAgo && typeof evt?.amount === 'number' && evt.amount > 0) {
      sumTTM += evt.amount; // valor por ação
    }
  }
  const dividend_yield = sumTTM > 0 ? (sumTTM / preco_atual) * 100 : 0;

  const result = { preco_atual, dividend_yield: Number(dividend_yield.toFixed(2)) };
  cache.set(normalizedTicker, { ...result, timestamp: Date.now() });
  return result;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ativos } = await req.json();

    if (!Array.isArray(ativos) || ativos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum ativo fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${ativos.length} ativos...`);

    // Busca cotações em paralelo
    const promises = ativos.map(async (asset: Asset) => {
      try {
        const ticker_normalizado = normalizeTicker(asset.ticker);
        const yahooData = await getYahooData(asset.ticker);

        const preco_atual = yahooData.preco_atual;
        const valor_total = preco_atual * asset.quantidade;
        const variacao_percentual = ((preco_atual - asset.preco_medio) / asset.preco_medio) * 100;
        const pl_posicao = (preco_atual - asset.preco_medio) * asset.quantidade;

        return {
          ...asset,
          ticker_normalizado,
          preco_atual,
          valor_total,
          variacao_percentual,
          dividend_yield: yahooData.dividend_yield,
          pl_posicao,
        };
      } catch (error) {
        console.error(`Erro ao processar ${asset.ticker}:`, error);
        // Retorna valores zerados em caso de erro
        return {
          ...asset,
          ticker_normalizado: normalizeTicker(asset.ticker),
          preco_atual: 0,
          valor_total: 0,
          variacao_percentual: 0,
          dividend_yield: 0,
          pl_posicao: 0,
          error: `Não foi possível obter cotação para ${asset.ticker}`,
        };
      }
    });

    const calculatedAssets = await Promise.all(promises);

    // Calcula resumo da carteira (excluindo ativos com erro)
    const validAssets = calculatedAssets.filter(a => a.preco_atual > 0);
    const valor_total_carteira = validAssets.reduce((sum, asset) => sum + asset.valor_total, 0);
    const pl_total = validAssets.reduce((sum, asset) => sum + asset.pl_posicao, 0);

    // DY ponderado
    const dy_ponderado = validAssets.reduce((sum, asset) => {
      const participacao = asset.valor_total / valor_total_carteira;
      return sum + asset.dividend_yield * participacao;
    }, 0);

    const resumo = {
      valor_total_carteira,
      dy_ponderado,
      pl_total,
    };

    return new Response(
      JSON.stringify({ ativos: calculatedAssets, resumo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro no calculate-assets:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
