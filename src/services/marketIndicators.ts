export interface Indicator {
  name: string;
  symbol: string;
  price: number | null;
  changePct: number | null;
  currency: string;
  source: string;
  time: string | null;
}

function toNumber(v: any): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

// ========== DÓLAR ==========
async function fetchUsdBrl(): Promise<Indicator> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { cache: 'no-store' });
    const json = await res.json();
    const data = json?.USDBRL;
    const price = toNumber(data?.bid);
    const pct = toNumber(data?.pctChange);
    if (price !== null) {
      return { name: 'Dólar', symbol: 'USD/BRL', price, changePct: pct, currency: 'BRL', source: 'awesomeapi', time: null };
    }
  } catch (err) {
    console.error('Erro USD:', err);
  }
  return { name: 'Dólar', symbol: 'USD/BRL', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

// ========== BITCOIN ==========
async function fetchBtcBrl(): Promise<Indicator> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/BTC-BRL', { cache: 'no-store' });
    const json = await res.json();
    const data = json?.BTCBRL;
    const price = toNumber(data?.bid);
    const pct = toNumber(data?.pctChange);
    if (price !== null) {
      return { name: 'Bitcoin', symbol: 'BTC/BRL', price, changePct: pct, currency: 'BRL', source: 'awesomeapi', time: null };
    }
  } catch (err) {
    console.error('Erro BTC:', err);
  }
  return { name: 'Bitcoin', symbol: 'BTC/BRL', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

// ========== IBOVESPA ==========
async function fetchIbovespa(): Promise<Indicator> {
  try {
    const res = await fetch('https://brapi.dev/api/quote/%5EBVSP?token=aQWusEB42RUrZwvkRMhmPP', { cache: 'no-store' });
    const json = await res.json();
    const data = json?.results?.[0];
    const price = toNumber(data?.regularMarketPrice);
    const pct = toNumber(data?.regularMarketChangePercent);
    if (price !== null) {
      return { name: 'Ibovespa', symbol: 'IBOV', price, changePct: pct, currency: 'BRL', source: 'brapi', time: null };
    }
  } catch (err) {
    console.error('Erro IBOV:', err);
  }
  return { name: 'Ibovespa', symbol: 'IBOV', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

// ========== ÍNDICES AMERICANOS (em BRL) ==========
async function fetchUSIndex(symbol: string, name: string, usdRate: number): Promise<Indicator> {
  const brapiSymbols: Record<string, string> = {
    '^GSPC': '%5EGSPC',  // S&P 500
    '^DJI': '%5EDJI',     // Dow Jones
    '^NDX': '%5ENDX',     // Nasdaq
  };
  
  const brapiSymbol = brapiSymbols[symbol];
  if (!brapiSymbol) {
    return { name, symbol, price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
  }

  try {
    const res = await fetch(`https://brapi.dev/api/quote/${brapiSymbol}?token=aQWusEB42RUrZwvkRMhmPP`, { cache: 'no-store' });
    const json = await res.json();
    const data = json?.results?.[0];
    const priceUSD = toNumber(data?.regularMarketPrice);
    const pct = toNumber(data?.regularMarketChangePercent);
    
    if (priceUSD !== null) {
      const priceBRL = priceUSD * usdRate;
      return { name, symbol, price: priceBRL, changePct: pct, currency: 'BRL', source: 'brapi', time: null };
    }
  } catch (err) {
    console.error(`Erro ${name}:`, err);
  }
  
  return { name, symbol, price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

// ========== BUSCAR TODOS ==========
export async function fetchAllIndicators(): Promise<Indicator[]> {
  // Buscar em paralelo
  const [usd, btc, ibov] = await Promise.all([
    fetchUsdBrl(),
    fetchBtcBrl(),
    fetchIbovespa(),
  ]);

  // Usar taxa USD para converter índices americanos
  const usdRate = usd.price || 5.30; // fallback
  
  const [sp500, dow, nasdaq] = await Promise.all([
    fetchUSIndex('^GSPC', 'S&P 500', usdRate),
    fetchUSIndex('^DJI', 'Dow Jones', usdRate),
    fetchUSIndex('^NDX', 'Nasdaq 100', usdRate),
  ]);

  return [ibov, usd, btc, sp500, dow, nasdaq];
}
