import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Cache simples em memória com TTL de 15 minutos
const cache = new Map<string, { preco_atual: number; dividend_yield: number; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

function normalizeTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().trim();
  return upperTicker.endsWith(".SA") ? upperTicker : `${upperTicker}.SA`;
}

async function getYahooData(ticker: string): Promise<{ preco_atual: number; dividend_yield: number }> {
  const normalizedTicker = normalizeTicker(ticker);
  
  // Verifica cache
  const cached = cache.get(normalizedTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit para ${normalizedTicker}`);
    return { preco_atual: cached.preco_atual, dividend_yield: cached.dividend_yield };
  }

  console.log(`Buscando cotação real para ${normalizedTicker}`);

  try {
    // Busca preço atual
    const priceResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!priceResponse.ok) {
      throw new Error(`Yahoo Finance API retornou ${priceResponse.status} para ${normalizedTicker}`);
    }

    const priceData: YahooQuoteResponse = await priceResponse.json();
    
    if (priceData.chart.error) {
      throw new Error(`Yahoo Finance error: ${priceData.chart.error.description}`);
    }

    const preco_atual = priceData.chart.result[0]?.meta?.regularMarketPrice;

    if (!preco_atual) {
      throw new Error(`Preço não encontrado para ${normalizedTicker}`);
    }

    // Busca dividend yield
    let dividend_yield = 0;
    try {
      const statsResponse = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${normalizedTicker}?modules=summaryDetail`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const trailingYield = statsData.quoteSummary?.result?.[0]?.summaryDetail?.trailingAnnualDividendYield?.raw;
        if (trailingYield) {
          dividend_yield = trailingYield * 100; // Converte para porcentagem
        }
      }
    } catch (error) {
      console.warn(`Não foi possível obter dividend yield para ${normalizedTicker}:`, error);
      // Continua sem o dividend yield
    }

    // Armazena no cache
    const result = { preco_atual, dividend_yield };
    cache.set(normalizedTicker, { ...result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error(`Erro ao buscar dados para ${normalizedTicker}:`, error);
    throw error;
  }
}

serve(async (req) => {
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
