import { Asset, CalculatedAsset, CalculateResponse, PortfolioSummary } from "@/types/asset";

// Cache simples em memória com TTL de 15 minutos
interface CacheEntry {
  data: {
    preco_atual: number;
    dividend_yield: number;
  };
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos em ms

// Mock de dados do Yahoo Finance para demonstração
// Preços atualizados em novembro de 2025
const mockYahooData: Record<string, { preco_atual: number; dividend_yield: number }> = {
  "PETR4.SA": { preco_atual: 32.06, dividend_yield: 12.5 },
  "VALE3.SA": { preco_atual: 65.73, dividend_yield: 9.8 },
  "ITUB4.SA": { preco_atual: 39.46, dividend_yield: 7.2 },
  "BBDC4.SA": { preco_atual: 18.70, dividend_yield: 8.5 },
  "BBAS3.SA": { preco_atual: 20.42, dividend_yield: 10.1 },
  "WEGE3.SA": { preco_atual: 42.82, dividend_yield: 1.8 },
  "RENT3.SA": { preco_atual: 42.81, dividend_yield: 5.4 },
  "GGBR4.SA": { preco_atual: 18.58, dividend_yield: 11.2 },
  "TAEE11.SA": { preco_atual: 40.48, dividend_yield: 8.9 },
  "CPLE6.SA": { preco_atual: 14.21, dividend_yield: 9.5 },
};

function normalizeTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().trim();
  return upperTicker.endsWith(".SA") ? upperTicker : `${upperTicker}.SA`;
}

function getTipoAtivo(ticker: string): string {
  const upperTicker = ticker.toUpperCase();
  const cleaned = upperTicker.replace('.SA','');
  const etfPrefixes = ['BOVA', 'SMAL', 'IVVB', 'SPXI', 'PIBB', 'BRAX', 'FIND', 'MATB', 'DIVO', 'HASH', 'ISUS', 'WRLD', 'NDIV', 'BOVV', 'ECOO', 'XFIX', 'B5P2'];
  if (etfPrefixes.some(prefix => cleaned.startsWith(prefix))) return 'ETF';
  if (cleaned.endsWith('11')) return 'FII';
  if (/[3-9]$/.test(cleaned)) return 'Ação';
  return 'Outro';
}

function getCachedData(ticker: string) {
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(ticker: string, data: { preco_atual: number; dividend_yield: number }) {
  cache.set(ticker, {
    data,
    timestamp: Date.now(),
  });
}

function getYahooData(ticker: string): { preco_atual: number; dividend_yield: number } {
  // Verifica cache primeiro
  const cached = getCachedData(ticker);
  if (cached) {
    return cached;
  }

  // Simula busca no Yahoo Finance
  const data = mockYahooData[ticker] || {
    // Valores aleatórios para tickers não mockados
    preco_atual: parseFloat((Math.random() * 100 + 10).toFixed(2)),
    dividend_yield: parseFloat((Math.random() * 15).toFixed(2)),
  };

  // Armazena no cache
  setCachedData(ticker, data);
  return data;
}

export async function calculateAssets(assets: Asset[]): Promise<CalculateResponse> {
  // Simula delay de rede (200-500ms)
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 300 + 200));

  const baseAssets = assets.map((asset) => {
    const ticker_normalizado = normalizeTicker(asset.ticker);
    const yahooData = getYahooData(ticker_normalizado);
    const tipo_ativo = getTipoAtivo(asset.ticker);

    const preco_atual = yahooData.preco_atual;
    const valor_total = preco_atual * asset.quantidade;
    const variacao_percentual = ((preco_atual - asset.preco_medio) / asset.preco_medio) * 100;
    const pl_posicao = (preco_atual - asset.preco_medio) * asset.quantidade;
    const dividend_yield = yahooData.dividend_yield;

    const dividendos_por_acao = (dividend_yield / 100) * preco_atual;
    const yoc = (dividendos_por_acao / asset.preco_medio) * 100;
    const projecao_dividendos_anual = dividendos_por_acao * asset.quantidade;

    return {
      ...asset,
      ticker_normalizado,
      preco_atual,
      valor_total,
      variacao_percentual,
      dividend_yield,
      pl_posicao,
      tipo_ativo,
      yoc: Number(yoc.toFixed(2)),
      projecao_dividendos_anual: Number(projecao_dividendos_anual.toFixed(2)),
    } as Omit<CalculatedAsset, 'peso_carteira'>;
  });

  const totalCarteira = baseAssets.reduce((sum, a) => sum + a.valor_total, 0) || 1;
  const calculatedAssets: CalculatedAsset[] = baseAssets.map(a => ({
    ...a,
    peso_carteira: Number(((a.valor_total / totalCarteira) * 100).toFixed(2)),
  }));

  // Calcula resumo da carteira
  const valor_total_carteira = calculatedAssets.reduce((sum, asset) => sum + asset.valor_total, 0);
  const pl_total = calculatedAssets.reduce((sum, asset) => sum + asset.pl_posicao, 0);

  // DY ponderado = soma(DY * participação_na_carteira)
  const dy_ponderado = calculatedAssets.reduce((sum, asset) => {
    const participacao = asset.valor_total / valor_total_carteira;
    return sum + asset.dividend_yield * participacao;
  }, 0);

  const resumo: PortfolioSummary = {
    valor_total_carteira,
    dy_ponderado,
    pl_total,
  };

  return {
    ativos: calculatedAssets,
    resumo,
  };
}
