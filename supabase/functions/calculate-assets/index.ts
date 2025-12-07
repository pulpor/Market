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
  tipo_ativo_manual?: string;
  indice_referencia?: string;
  taxa_contratada?: number;
  data_vencimento?: string;
  data_aplicacao?: string;
  valor_atual_rf?: number;
  is_international?: boolean;
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

// Cache de taxa de câmbio
let exchangeRateCache: { rate: number; timestamp: number } | null = null;
const EXCHANGE_RATE_TTL = 60 * 60 * 1000; // 1 hora

async function getUSDtoBRLRate(): Promise<number> {
  // Verifica cache primeiro
  if (exchangeRateCache && Date.now() - exchangeRateCache.timestamp < EXCHANGE_RATE_TTL) {
    console.log(`💱 Taxa de câmbio do cache: ${exchangeRateCache.rate}`);
    return exchangeRateCache.rate;
  }

  try {
    // Tenta usar a API do Yahoo Finance para USD/BRL
    const response = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (response.ok) {
      const data = await response.json();
      const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof rate === 'number' && rate > 0) {
        exchangeRateCache = { rate, timestamp: Date.now() };
        console.log(`💱 Taxa de câmbio USD/BRL atualizada: ${rate}`);
        return rate;
      }
    }
  } catch (error) {
    console.warn(`⚠️ Erro ao buscar taxa de câmbio:`, error);
  }

  // Fallback: usa taxa aproximada (atualizar conforme necessário)
  const fallbackRate = 5.25; // Taxa aproximada em 07/12/2025
  exchangeRateCache = { rate: fallbackRate, timestamp: Date.now() };
  console.log(`💱 Usando taxa de câmbio fallback: ${fallbackRate}`);
  return fallbackRate;
}

function normalizeTicker(ticker: string, isInternational?: boolean): string {
  const upperTicker = ticker.toUpperCase().trim();
  
  // Se é internacional, retorna sem sufixo
  if (isInternational) return upperTicker;
  
  // Se é BDR brasileiro (usa .DF), mantém o sufixo
  if (upperTicker.endsWith(".DF")) return upperTicker;
  
  // Caso contrário, adiciona .SA para ativos brasileiros
  return upperTicker.endsWith(".SA") ? upperTicker : `${upperTicker}.SA`;
}

function getTipoAtivo(ticker: string, setor?: string): string {
  const upper = ticker.toUpperCase().replace('.SA', '');
  const etfPrefixes = ['BOVA', 'SMAL', 'IVVB', 'SPXI', 'PIBB', 'BRAX', 'FIND', 'MATB', 'DIVO', 'HASH', 'ISUS', 'WRLD', 'NDIV', 'BOVV', 'ECOO', 'XFIX', 'B5P2'];
  if (etfPrefixes.some(prefix => upper.startsWith(prefix))) return 'ETF';

  const nonFiiUnits = new Set(['TAEE11', 'SANB11', 'SAPR11', 'KLBN11', 'ALUP11', 'STBP11', 'ITUB11', 'BBDC11']);
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
  const nonFiiUnits = new Set(['TAEE11', 'SANB11', 'SAPR11', 'KLBN11', 'ALUP11', 'STBP11', 'ITUB11', 'BBDC11']);
  if (upperTicker.endsWith('11') && !nonFiiUnits.has(upperTicker) && !etfPrefixes.some(p => upperTicker.startsWith(p))) {
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

async function getYahooData(ticker: string, isInternational?: boolean): Promise<{ preco_atual: number; dividend_yield: number; setor?: string; tipo_ativo: string }> {
  console.log(`\n=== INICIANDO getYahooData ===`);
  console.log(`Parâmetros: ticker="${ticker}", isInternational=${isInternational} (tipo: ${typeof isInternational})`);
  
  const normalizedTicker = normalizeTicker(ticker, isInternational);
  console.log(`🔍 Buscando dados para ${ticker} (normalizado: ${normalizedTicker}, internacional: ${isInternational})`);

  // Cache curto para evitar excesso de chamadas (preço + DY TTM)
  const cached = cache.get(normalizedTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ Cache hit para ${normalizedTicker}`);
    return { preco_atual: cached.preco_atual, dividend_yield: cached.dividend_yield, setor: cached.setor, tipo_ativo: cached.tipo_ativo };
  }

  // Usa query2 com range de 1d para pegar o preço de fechamento mais recente (não ajustado)
  const urlQuote = `https://query2.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=1d`;
  console.log(`📡 URL de cotação: ${urlQuote}`);
  const urlDiv = `https://query2.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=2y&events=div`;

  // Busca preço atual (regularMarketPrice do último dia)
  const respQuote = await fetch(urlQuote, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!respQuote.ok) throw new Error(`Falha ao buscar cotação ${respQuote.status} para ${normalizedTicker}`);

  const dataQuote = await respQuote.json();
  const chartQuote = dataQuote?.chart?.result?.[0];
  if (!chartQuote) {
    console.error(`❌ Chart vazio para ${normalizedTicker}. Response:`, dataQuote);
    throw new Error(`Chart vazio para ${normalizedTicker}`);
  }

  const preco_atual = chartQuote?.meta?.regularMarketPrice;
  const currency = chartQuote?.meta?.currency || 'USD';
  console.log(`💰 Preço encontrado para ${normalizedTicker}: ${preco_atual} ${currency}`);
  if (typeof preco_atual !== 'number' || preco_atual <= 0) {
    console.error(`❌ Preço inválido para ${normalizedTicker}: ${preco_atual}`);
    throw new Error(`Preço inválido para ${normalizedTicker}`);
  }

  // Converte para BRL se for ativo internacional em USD
  let precoEmBRL = preco_atual;
  if (isInternational && currency === 'USD') {
    console.log(`💱 Convertendo ${preco_atual} USD para BRL...`);
    const taxaCambio = await getUSDtoBRLRate();
    precoEmBRL = preco_atual * taxaCambio;
    console.log(`💱 ${preco_atual} USD × ${taxaCambio} = ${precoEmBRL.toFixed(2)} BRL`);
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
  const result = { preco_atual: precoEmBRL, dividend_yield: Number(dividend_yield.toFixed(2)), setor, tipo_ativo };
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
    console.log(`📋 Ativos recebidos:`, JSON.stringify(ativos.map(a => ({ ticker: a.ticker, is_international: a.is_international })), null, 2));
    
    // Log específico para SPHD
    const sphd = ativos.find(a => a.ticker.toUpperCase() === 'SPHD');
    if (sphd) {
      console.log(`🔍 SPHD encontrado:`, JSON.stringify(sphd, null, 2));
    }

    // Busca cotações em paralelo
    function toNumber(val: unknown): number | undefined {
      const n = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : undefined);
      return Number.isFinite(n as number) ? (n as number) : undefined;
    }

    function isBusinessDay(d: Date): boolean {
      const day = d.getDay();
      return day !== 0 && day !== 6; // desconsidera finais de semana (feriados ignorados no MVP)
    }
    function businessDaysBetween(fromISO: string, to: Date): number {
      const from = new Date(fromISO);
      if (to <= from) return 0;
      let count = 0;
      const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      while (cur < to) {
        if (isBusinessDay(cur)) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    }

    // Taxas anuais base aproximadas (MVP). TODO: trocar por fonte oficial (Bacen/IBGE)
    const CDI_ANUAL_PADRAO = 12.65; // % a.a.
    const SELIC_ANUAL_PADRAO = 12.25; // % a.a.
    const IPCA_ANUAL_PADRAO = 4.5; // % a.a.

    function computeRfValorAtual(asset: Asset): number | undefined {
      const principal = toNumber(asset.preco_medio);
      if (!principal || principal <= 0) return undefined;

      const dataAplic = asset.data_aplicacao;
      const taxa = toNumber(asset.taxa_contratada);
      const indice = (asset.indice_referencia || '').toUpperCase();

      if (!dataAplic || !indice) return undefined; // precisa pelo menos da data de aplicação e do índice

      const hoje = new Date();
      // Base de contagem: 252 para CDI/Selic/LCI/LCA/CDB/Tesouro; caso contrário, 365
      const tipo = (asset.tipo_ativo_manual || '').toUpperCase();
      const usa252 = indice.includes('CDI') || indice.includes('SELIC') ||
        tipo.includes('LCI') || tipo.includes('LCA') || tipo.includes('CDB') || tipo.includes('TESOURO');
      const dias = usa252 ? businessDaysBetween(dataAplic, hoje) : Math.max(0, Math.floor((hoje.getTime() - new Date(dataAplic).getTime()) / (1000 * 60 * 60 * 24)));
      if (dias <= 0) return principal; // sem dias decorridos, sem acréscimo

      let taxaAnual: number | undefined;

      if (indice.includes('PRÉ')) {
        taxaAnual = taxa; // já é nominal a.a.
      } else if (indice.includes('SELIC')) {
        taxaAnual = taxa ?? SELIC_ANUAL_PADRAO;
      } else if (indice.includes('CDI')) {
        // Heurística: taxa >= 20 => % do CDI (ex: 110 => 110% do CDI). Caso contrário, trata como CDI + spread (% absoluto)
        if (typeof taxa === 'number') {
          if (taxa >= 20) {
            taxaAnual = (taxa / 100) * CDI_ANUAL_PADRAO; // 110 => 1.10 * CDI
          } else {
            taxaAnual = CDI_ANUAL_PADRAO + taxa; // CDI + X%
          }
        } else {
          taxaAnual = CDI_ANUAL_PADRAO;
        }
      } else if (indice.includes('IPCA') || indice.includes('IGP')) {
        taxaAnual = (IPCA_ANUAL_PADRAO) + (taxa ?? 0); // IPCA + spread
      } else {
        // Desconhecido: usa taxa contratada se houver
        taxaAnual = taxa;
      }

      if (typeof taxaAnual !== 'number' || !Number.isFinite(taxaAnual)) return undefined;

      const baseDias = usa252 ? 252 : 365;
      const taxaDia = taxaAnual / 100 / baseDias;
      const fator = Math.pow(1 + taxaDia, dias);
      return principal * fator;
    }

    const promises = ativos.map(async (asset: Asset) => {
      try {
        // Log EXTREMAMENTE específico para SPHD
        if (asset.ticker.toUpperCase() === 'SPHD') {
          console.log(`\n🚨 SPHD DETECTADO NA PROMISE MAP 🚨`);
          console.log(`Asset completo:`, JSON.stringify(asset, null, 2));
          console.log(`asset.is_international tipo: ${typeof asset.is_international}, valor: ${asset.is_international}`);
        }
        
        // Se tipo manual está definido (Previdência, Tesouro, etc), não busca Yahoo
        if (asset.tipo_ativo_manual) {
          const valorAplicado = asset.preco_medio;
          const estimado = computeRfValorAtual(asset);
          const valorAtual = (typeof asset.valor_atual_rf === 'number' && asset.valor_atual_rf > 0)
            ? asset.valor_atual_rf
            : (estimado ?? valorAplicado);
          const valor_total = valorAtual;
          const rentabilidade = ((valorAtual - valorAplicado) / valorAplicado) * 100;

          return {
            ...asset,
            ticker_normalizado: asset.ticker.toUpperCase(),
            preco_atual: valorAtual,
            valor_total,
            variacao_percentual: rentabilidade,
            dividend_yield: 0, // Renda fixa não tem DY
            pl_posicao: valorAtual - valorAplicado,
            setor: asset.tipo_ativo_manual, // Usa tipo como setor
            tipo_ativo: asset.tipo_ativo_manual,
          };
        }

        // Valida se ticker parece válido (sem espaços excessivos ou muito longo)
        const tickerTrimmed = asset.ticker.trim();
        const hasSpaces = tickerTrimmed.includes(' ');
        const isTooLong = tickerTrimmed.length > 20;
        
        if (hasSpaces || isTooLong) {
          console.warn(`⚠️ Ticker suspeito (pode ser renda fixa): "${asset.ticker}" - tem espaços: ${hasSpaces}, comprimento: ${tickerTrimmed.length}`);
          throw new Error(`Ticker inválido ou não suportado: "${asset.ticker}"`);
        }

        // Busca via Yahoo para ativos da bolsa
        const ticker_normalizado = normalizeTicker(asset.ticker, asset.is_international);
        
        if (asset.ticker.toUpperCase() === 'SPHD') {
          console.log(`\n🚨 SPHD ANTES DE CHAMAR getYahooData 🚨`);
          console.log(`asset.ticker: "${asset.ticker}"`);
          console.log(`asset.is_international: ${asset.is_international} (tipo: ${typeof asset.is_international})`);
          console.log(`ticker_normalizado: "${ticker_normalizado}"`);
        }
        
        console.log(`🔄 Normalizando ticker: ${asset.ticker} + is_international=${asset.is_international} => ${ticker_normalizado}`);
        console.log(`🔄 Antes de chamar getYahooData:`, { ticker: asset.ticker, is_international: asset.is_international, tipo: typeof asset.is_international });
        const yahooData = await getYahooData(asset.ticker, asset.is_international);
        console.log(`✅ getYahooData retornou para ${ticker_normalizado}:`, yahooData);

        const preco_atual = yahooData.preco_atual;
        const valor_total = preco_atual * asset.quantidade;
        const variacao_percentual = ((preco_atual - asset.preco_medio) / asset.preco_medio) * 100;
        const pl_posicao = (preco_atual - asset.preco_medio) * asset.quantidade;

        const successReturn = {
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
        
        console.log(`✅ Sucesso ao processar ${asset.ticker}: ticker_normalizado=${ticker_normalizado}`);
        return successReturn;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Erro ao processar ${asset.ticker}:`, errorMsg);
        console.error(`❌ Asset antes do catch:`, { ticker: asset.ticker, is_international: asset.is_international, tipo_ativo_manual: asset.tipo_ativo_manual });
        
        const ticker_norm = normalizeTicker(asset.ticker, asset.is_international);
        console.error(`❌ Ticker normalizado DENTRO DO CATCH: ${asset.ticker} + is_international=${asset.is_international} => ${ticker_norm}`);
        
        // Retorna valores zerados em caso de erro
        const errorReturn = {
          ...asset,
          ticker_normalizado: ticker_norm,
          preco_atual: 0,
          valor_total: 0,
          variacao_percentual: 0,
          dividend_yield: 0,
          pl_posicao: 0,
          error: `Não foi possível obter cotação para ${asset.ticker}: ${errorMsg}`,
        };
        
        console.error(`❌ Retornando do catch:`, { ticker_normalizado: errorReturn.ticker_normalizado, is_international: errorReturn.is_international });
        return errorReturn;
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
