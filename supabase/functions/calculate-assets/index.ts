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
const cache = new Map<string, { preco_atual: number; dividend_yield: number; setor?: string; tipo_ativo: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (dados reais devem ser atualizados frequentemente)

function normalizeTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().trim();
  return upperTicker.endsWith(".SA") ? upperTicker : `${upperTicker}.SA`;
}

function getTipoAtivo(ticker: string, setor?: string): string {
  const upper = ticker.toUpperCase().replace('.SA','');
  const etfPrefixes = ['BOVA', 'SMAL', 'IVVB', 'SPXI', 'PIBB', 'BRAX', 'FIND', 'MATB', 'DIVO', 'HASH', 'ISUS', 'WRLD', 'NDIV', 'BOVV', 'ECOO', 'XFIX', 'B5P2'];
  if (etfPrefixes.some(prefix => upper.startsWith(prefix))) return 'ETF';

  const nonFiiUnits = new Set(['TAEE11','SANB11','SAPR11','KLBN11','ALUP11','STBP11','ITUB11','BBDC11']);
  const ends11 = upper.endsWith('11');
  const setorLower = (setor || '').toLowerCase();
  const isImobiliario = setorLower.includes('imobili') || setorLower.includes('real');

  // FII se: setor imobiliário, ou termina em 11 e NÃO está na lista de units não-FII
  if (isImobiliario) return 'FII';
  if (ends11 && !nonFiiUnits.has(upper)) return 'FII';

  if (/[3-9]$/.test(upper) || ends11) return 'Ação';
  return 'Outro';
}

function formatSetor(setor: string | undefined): string {
  if (!setor) return 'Outros';
  
  // Tradução dos setores do Yahoo Finance para português
  const traducoes: Record<string, string> = {
    'Financial Services': 'Serviços Financeiros',
    'Energy': 'Energia',
    'Basic Materials': 'Materiais Básicos',
    'Industrials': 'Industrial',
    'Consumer Cyclical': 'Consumo Cíclico',
    'Consumer Defensive': 'Consumo Defensivo',
    'Healthcare': 'Saúde',
    'Technology': 'Tecnologia',
    'Communication Services': 'Comunicação',
    'Utilities': 'Utilidades Públicas',
    'Real Estate': 'Imobiliário',
  };
  
  // Se for um setor conhecido do Yahoo, traduz
  if (traducoes[setor]) {
    return traducoes[setor];
  }
  
  // Caso contrário, formata em Pascal Case
  return setor
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function inferirSetorPorTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().replace('.SA', '');
  const etfPrefixes = ['BOVA', 'SMAL', 'IVVB', 'SPXI', 'PIBB', 'BRAX', 'FIND', 'MATB', 'DIVO', 'HASH', 'ISUS', 'WRLD', 'NDIV', 'BOVV', 'ECOO', 'XFIX', 'B5P2'];
  const nonFiiUnits = new Set(['TAEE11','SANB11','SAPR11','KLBN11','ALUP11','STBP11','ITUB11','BBDC11']);
  if (upperTicker.endsWith('11') && !nonFiiUnits.has(upperTicker) && !etfPrefixes.some(p=>upperTicker.startsWith(p))) {
    return 'Imobiliário';
  }
  
  // Mapeamento manual dos principais tickers brasileiros
  const setorMap: Record<string, string> = {
    // Petróleo e Gás
    'PETR3': 'Energia', 'PETR4': 'Energia', 'PRIO3': 'Energia', 'RRRP3': 'Energia',
    'RECV3': 'Energia', 'ENAT3': 'Energia', 'CSAN3': 'Energia',
    
    // Mineração
    'VALE3': 'Materiais Básicos', 'GOAU4': 'Materiais Básicos', 'GGBR4': 'Materiais Básicos',
    
    // Bancos
    'ITUB3': 'Serviços Financeiros', 'ITUB4': 'Serviços Financeiros',
    'BBDC3': 'Serviços Financeiros', 'BBDC4': 'Serviços Financeiros',
    'BBAS3': 'Serviços Financeiros', 'SANB11': 'Serviços Financeiros',
    'BBSE3': 'Serviços Financeiros', 'BPAN4': 'Serviços Financeiros',
    
    // Varejo
    'MGLU3': 'Consumo Cíclico', 'LREN3': 'Consumo Cíclico', 'AMER3': 'Consumo Cíclico',
    'VIIA3': 'Consumo Cíclico', 'PETZ3': 'Consumo Cíclico', 'BHIA3': 'Consumo Cíclico',
    
    // Alimentos
    'ABEV3': 'Consumo Defensivo', 'JBSS3': 'Consumo Defensivo', 'MRFG3': 'Consumo Defensivo',
    'BEEF3': 'Consumo Defensivo', 'SMTO3': 'Consumo Defensivo',
    
    // Utilities
    'ELET3': 'Utilidades Públicas', 'ELET6': 'Utilidades Públicas',
    'CMIG3': 'Utilidades Públicas', 'CMIG4': 'Utilidades Públicas',
    'TAEE11': 'Utilidades Públicas', 'CPLE6': 'Utilidades Públicas',
    'SAPR11': 'Utilidades Públicas', 'SBSP3': 'Utilidades Públicas',
    
    // Construção
    'CYRE3': 'Imobiliário', 'MRVE3': 'Imobiliário', 'TEND3': 'Imobiliário',
    
    // Tecnologia
    'TOTS3': 'Tecnologia', 'LWSA3': 'Tecnologia',
    
    // Industrial
    'WEGE3': 'Industrial', 'RAIZ4': 'Industrial', 'RAIL3': 'Industrial',
  };
  
  return setorMap[upperTicker] || 'Outros';
}

async function getYahooData(ticker: string): Promise<{ preco_atual: number; dividend_yield: number; setor?: string; tipo_ativo: string }> {
  const normalizedTicker = normalizeTicker(ticker);

  // Cache curto para evitar excesso de chamadas (preço + DY TTM)
  const cached = cache.get(normalizedTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { preco_atual: cached.preco_atual, dividend_yield: cached.dividend_yield, setor: cached.setor, tipo_ativo: cached.tipo_ativo };
  }

  // Usa query2 com range de 1d para pegar o preço de fechamento mais recente (não ajustado)
  const urlQuote = `https://query2.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=1d`;
  const urlDiv = `https://query2.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=2y&events=div`;
  
  // Busca preço atual (regularMarketPrice do último dia)
  const respQuote = await fetch(urlQuote, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!respQuote.ok) throw new Error(`Falha ao buscar cotação ${respQuote.status} para ${normalizedTicker}`);
  
  const dataQuote = await respQuote.json();
  const chartQuote = dataQuote?.chart?.result?.[0];
  if (!chartQuote) throw new Error(`Chart vazio para ${normalizedTicker}`);

  const preco_atual = chartQuote?.meta?.regularMarketPrice;
  if (typeof preco_atual !== 'number' || preco_atual <= 0) {
    throw new Error(`Preço inválido para ${normalizedTicker}`);
  }

  // Busca dividendos dos últimos 12 meses (TTM)
  const respDiv = await fetch(urlDiv, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  
  let dividend_yield = 0;
  if (respDiv.ok) {
    const dataDiv = await respDiv.json();
    const chartDiv = dataDiv?.chart?.result?.[0];
    const events = chartDiv?.events?.dividends ?? {};
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    let sumTTM = 0;
    
    for (const key in events) {
      const evt = events[key];
      const tsMs = (evt?.date ?? 0) * 1000;
      if (tsMs >= oneYearAgo && typeof evt?.amount === 'number' && evt.amount > 0) {
        sumTTM += evt.amount; // valor por ação
      }
    }
    
    dividend_yield = sumTTM > 0 ? (sumTTM / preco_atual) * 100 : 0;
  }

  // Tenta buscar informações do setor via quoteSummary
  let setor = 'Outros';
  
  try {
    // Primeiro tenta pelo summaryProfile (mais confiável para BDRs e ações BR)
    const urlQuoteSummary = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${normalizedTicker}?modules=summaryProfile,assetProfile`;
    const respSummary = await fetch(urlQuoteSummary, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (respSummary.ok) {
      const dataSummary = await respSummary.json();
      const result = dataSummary?.quoteSummary?.result?.[0];
      const setorBruto = result?.assetProfile?.sector || result?.summaryProfile?.sector;
      
      if (setorBruto) {
        setor = formatSetor(setorBruto);
        console.log(`Setor encontrado para ${normalizedTicker}: ${setor}`);
      }
    }
  } catch (error) {
    console.log(`Erro ao buscar setor para ${normalizedTicker}:`, error);
  }
  
  // Se ainda não achou, tenta inferir pelo ticker
  if (setor === 'Outros') {
    setor = inferirSetorPorTicker(normalizedTicker);
  }

  // Determina tipo_ativo somente após resolver setor
  const tipo_ativo = getTipoAtivo(ticker, setor);
  const result = { preco_atual, dividend_yield: Number(dividend_yield.toFixed(2)), setor, tipo_ativo };
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
          setor: yahooData.setor,
          tipo_ativo: yahooData.tipo_ativo,
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
