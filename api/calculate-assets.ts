export const config = {
  runtime: 'edge',
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Asset {
  id: string;
  ticker: string;
  quantidade: number;
  preco_medio: number;
  setor?: string;
  corretora: string;
  tipo_ativo_manual?: string;
  indice_referencia?: string;
  taxa_contratada?: number;
  data_vencimento?: string;
  data_aplicacao?: string;
  valor_atual_rf?: number;
  is_international?: boolean;
}

// Cache simples em memória com TTL de 5 minutos
const cache = new Map<
  string,
  {
    preco_atual: number;
    dividend_yield: number;
    setor?: string;
    tipo_ativo: string;
    timestamp: number;
  }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache de taxa de câmbio
let exchangeRateCache: { rate: number; timestamp: number } | null = null;
const EXCHANGE_RATE_TTL = 60 * 60 * 1000; // 1 hora

async function getUSDtoBRLRate(): Promise<number> {
  if (exchangeRateCache && Date.now() - exchangeRateCache.timestamp < EXCHANGE_RATE_TTL) {
    return exchangeRateCache.rate;
  }

  try {
    const response = await fetch(
      'https://query2.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
    );

    if (response.ok) {
      const data = await response.json();
      const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof rate === 'number' && rate > 0) {
        exchangeRateCache = { rate, timestamp: Date.now() };
        return rate;
      }
    }
  } catch {
    // ignore
  }

  const fallbackRate = 5.25;
  exchangeRateCache = { rate: fallbackRate, timestamp: Date.now() };
  return fallbackRate;
}

function normalizeTicker(ticker: string, isInternational?: boolean): string {
  const upperTicker = ticker.toUpperCase().trim();
  if (isInternational) return upperTicker;
  if (upperTicker.endsWith('.DF')) return upperTicker;
  return upperTicker.endsWith('.SA') ? upperTicker : `${upperTicker}.SA`;
}

function getTipoAtivo(ticker: string, setor?: string): string {
  const upper = ticker.toUpperCase().replace('.SA', '');
  const etfPrefixes = [
    'BOVA',
    'SMAL',
    'IVVB',
    'SPXI',
    'PIBB',
    'BRAX',
    'FIND',
    'MATB',
    'DIVO',
    'HASH',
    'ISUS',
    'WRLD',
    'NDIV',
    'BOVV',
    'ECOO',
    'XFIX',
    'B5P2',
  ];
  if (etfPrefixes.some(prefix => upper.startsWith(prefix))) return 'ETF';

  const nonFiiUnits = new Set([
    'TAEE11',
    'SANB11',
    'SAPR11',
    'KLBN11',
    'ALUP11',
    'STBP11',
    'ITUB11',
    'BBDC11',
  ]);
  const ends11 = upper.endsWith('11');
  const setorLower = (setor || '').toLowerCase();
  const isImobiliario = setorLower.includes('imobili') || setorLower.includes('real');

  if (isImobiliario) return 'FII';
  if (ends11 && !nonFiiUnits.has(upper)) return 'FII';

  if (/[3-9]$/.test(upper) || ends11) return 'Ação';
  return 'Outro';
}

function formatSetor(setor: string | undefined): string {
  if (!setor) return 'Outros';

  const traducoes: Record<string, string> = {
    'Financial Services': 'Serviços Financeiros',
    Energy: 'Energia',
    'Basic Materials': 'Materiais Básicos',
    Industrials: 'Industrial',
    'Consumer Cyclical': 'Consumo Cíclico',
    'Consumer Defensive': 'Consumo Defensivo',
    Healthcare: 'Saúde',
    Technology: 'Tecnologia',
    'Communication Services': 'Comunicação',
    Utilities: 'Utilidades Públicas',
    'Real Estate': 'Imobiliário',
  };

  if (traducoes[setor]) return traducoes[setor];

  return setor
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function inferirSetorPorTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().replace('.SA', '');
  const etfPrefixes = [
    'BOVA',
    'SMAL',
    'IVVB',
    'SPXI',
    'PIBB',
    'BRAX',
    'FIND',
    'MATB',
    'DIVO',
    'HASH',
    'ISUS',
    'WRLD',
    'NDIV',
    'BOVV',
    'ECOO',
    'XFIX',
    'B5P2',
  ];
  const nonFiiUnits = new Set([
    'TAEE11',
    'SANB11',
    'SAPR11',
    'KLBN11',
    'ALUP11',
    'STBP11',
    'ITUB11',
    'BBDC11',
  ]);
  if (
    upperTicker.endsWith('11') &&
    !nonFiiUnits.has(upperTicker) &&
    !etfPrefixes.some(p => upperTicker.startsWith(p))
  ) {
    return 'Imobiliário';
  }

  const setorMap: Record<string, string> = {
    PETR3: 'Energia',
    PETR4: 'Energia',
    PRIO3: 'Energia',
    RRRP3: 'Energia',
    RECV3: 'Energia',
    ENAT3: 'Energia',
    CSAN3: 'Energia',

    VALE3: 'Materiais Básicos',
    GOAU4: 'Materiais Básicos',
    GGBR4: 'Materiais Básicos',

    ITUB3: 'Serviços Financeiros',
    ITUB4: 'Serviços Financeiros',
    BBDC3: 'Serviços Financeiros',
    BBDC4: 'Serviços Financeiros',
    BBAS3: 'Serviços Financeiros',
    SANB11: 'Serviços Financeiros',
    BBSE3: 'Serviços Financeiros',
    BPAN4: 'Serviços Financeiros',

    MGLU3: 'Consumo Cíclico',
    LREN3: 'Consumo Cíclico',
    AMER3: 'Consumo Cíclico',
    VIIA3: 'Consumo Cíclico',
    PETZ3: 'Consumo Cíclico',
    BHIA3: 'Consumo Cíclico',

    ABEV3: 'Consumo Defensivo',
    JBSS3: 'Consumo Defensivo',
    MRFG3: 'Consumo Defensivo',
    BEEF3: 'Consumo Defensivo',
    SMTO3: 'Consumo Defensivo',

    ELET3: 'Utilidades Públicas',
    ELET6: 'Utilidades Públicas',
    CMIG3: 'Utilidades Públicas',
    CMIG4: 'Utilidades Públicas',
    TAEE11: 'Utilidades Públicas',
    CPLE6: 'Utilidades Públicas',
    SAPR11: 'Utilidades Públicas',
    SBSP3: 'Utilidades Públicas',

    CYRE3: 'Imobiliário',
    MRVE3: 'Imobiliário',
    TEND3: 'Imobiliário',

    TOTS3: 'Tecnologia',
    LWSA3: 'Tecnologia',

    WEGE3: 'Industrial',
    RAIZ4: 'Industrial',
    RAIL3: 'Industrial',
  };

  return setorMap[upperTicker] || 'Outros';
}

async function getYahooData(
  ticker: string,
  isInternational?: boolean,
): Promise<{ preco_atual: number; dividend_yield: number; setor?: string; tipo_ativo: string }> {
  const normalizedTicker = normalizeTicker(ticker, isInternational);

  const cached = cache.get(normalizedTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      preco_atual: cached.preco_atual,
      dividend_yield: cached.dividend_yield,
      setor: cached.setor,
      tipo_ativo: cached.tipo_ativo,
    };
  }

  const urlQuote = `https://query2.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=1d`;
  const urlDiv = `https://query2.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=2y&events=div`;

  const respQuote = await fetch(urlQuote, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!respQuote.ok) throw new Error(`Falha ao buscar cotação ${respQuote.status} para ${normalizedTicker}`);

  const dataQuote = await respQuote.json();
  const chartQuote = dataQuote?.chart?.result?.[0];
  if (!chartQuote) throw new Error(`Chart vazio para ${normalizedTicker}`);

  const preco_atual = chartQuote?.meta?.regularMarketPrice;
  const currency = chartQuote?.meta?.currency || 'USD';
  if (typeof preco_atual !== 'number' || preco_atual <= 0) {
    throw new Error(`Preço inválido para ${normalizedTicker}`);
  }

  let precoEmBRL = preco_atual;
  if (isInternational && currency === 'USD') {
    const taxaCambio = await getUSDtoBRLRate();
    precoEmBRL = preco_atual * taxaCambio;
  }

  const respDiv = await fetch(urlDiv, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
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
        sumTTM += evt.amount;
      }
    }

    dividend_yield = sumTTM > 0 ? (sumTTM / preco_atual) * 100 : 0;
  }

  let setor: string | undefined = undefined;
  try {
    const modulesUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${normalizedTicker}?modules=assetProfile`;
    const respProfile = await fetch(modulesUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (respProfile.ok) {
      const jsonProfile = await respProfile.json();
      const rawSetor =
        jsonProfile?.quoteSummary?.result?.[0]?.assetProfile?.sector;
      if (typeof rawSetor === 'string' && rawSetor.trim()) {
        setor = formatSetor(rawSetor);
      }
    }
  } catch {
    // ignore
  }

  if (!setor) {
    setor = inferirSetorPorTicker(normalizedTicker);
  }

  const tipo_ativo = getTipoAtivo(normalizedTicker, setor);

  cache.set(normalizedTicker, {
    preco_atual: precoEmBRL,
    dividend_yield,
    setor,
    tipo_ativo,
    timestamp: Date.now(),
  });

  return { preco_atual: precoEmBRL, dividend_yield, setor, tipo_ativo };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const assets: Asset[] = Array.isArray(body?.ativos) ? body.ativos : [];

    if (!Array.isArray(assets) || assets.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum ativo enviado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promises = assets.map(async (asset) => {
      try {
        const yahoo = await getYahooData(asset.ticker, asset.is_international);
        const preco_atual = yahoo.preco_atual;
        const dividend_yield = yahoo.dividend_yield;
        const setor = yahoo.setor;
        const tipo_ativo = yahoo.tipo_ativo;

        const valor_total = preco_atual * asset.quantidade;
        const variacao_percentual = asset.preco_medio > 0
          ? ((preco_atual - asset.preco_medio) / asset.preco_medio) * 100
          : 0;
        const pl_posicao = (preco_atual - asset.preco_medio) * asset.quantidade;
        const yoc = asset.preco_medio > 0 ? (dividend_yield * preco_atual) / asset.preco_medio : 0;
        const projecao_dividendos_anual = (dividend_yield / 100) * preco_atual * asset.quantidade;

        return {
          ...asset,
          setor,
          tipo_ativo,
          ticker_normalizado: normalizeTicker(asset.ticker, asset.is_international),
          preco_atual,
          valor_total,
          variacao_percentual,
          dividend_yield,
          pl_posicao,
          peso_carteira: 0,
          yoc,
          projecao_dividendos_anual,
        };
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        const ticker_norm = normalizeTicker(asset.ticker, asset.is_international);
        return {
          ...asset,
          ticker_normalizado: ticker_norm,
          preco_atual: 0,
          valor_total: 0,
          variacao_percentual: 0,
          dividend_yield: 0,
          pl_posicao: 0,
          peso_carteira: 0,
          yoc: 0,
          projecao_dividendos_anual: 0,
          error: `Não foi possível obter cotação para ${asset.ticker}: ${errorMsg}`,
        };
      }
    });

    const calculatedAssets = await Promise.all(promises);

    const validAssets = calculatedAssets.filter(a => a.preco_atual > 0);
    const valor_total_carteira = validAssets.reduce((sum, asset) => sum + asset.valor_total, 0);
    const pl_total = validAssets.reduce((sum, asset) => sum + asset.pl_posicao, 0);

    // Peso da carteira
    const withWeights = calculatedAssets.map((a) => {
      const peso = valor_total_carteira > 0 ? (a.valor_total / valor_total_carteira) * 100 : 0;
      return { ...a, peso_carteira: peso };
    });

    const dy_ponderado = validAssets.reduce((sum, asset) => {
      const participacao = valor_total_carteira > 0 ? asset.valor_total / valor_total_carteira : 0;
      return sum + asset.dividend_yield * participacao;
    }, 0);

    const resumo = {
      valor_total_carteira,
      dy_ponderado,
      pl_total,
    };

    return new Response(JSON.stringify({ ativos: withWeights, resumo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
}
