import { supabase } from "@/integrations/supabase/client";
export interface Indicator {
  name: string;
  symbol: string;
  price: number | null;
  changePct: number | null;
  currency?: string;
  source: string;
  time: string | null;
}

interface RawIndicator {
  name: string;
  symbol: string;
  price: unknown;
  changePct: unknown;
  currency?: string;
  source: string;
  time?: string | number | null;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

export async function fetchUsdBrl(): Promise<Indicator> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const json = await res.json();
    const d = json?.USDBRL || {};
    return {
      name: 'Dólar',
      symbol: 'USD/BRL',
      price: toNumber(d.bid),
      changePct: toNumber(d.pctChange),
      currency: 'BRL',
      source: 'awesomeapi',
      time: d?.create_date || null,
    };
  } catch {
    return { name: 'Dólar', symbol: 'USD/BRL', price: null, changePct: null, currency: 'BRL', source: 'awesomeapi', time: null };
  }
}

export async function fetchBtcBrl(): Promise<Indicator> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/BTC-BRL');
    const json = await res.json();
    const d = json?.BTCBRL || {};
    return {
      name: 'Bitcoin',
      symbol: 'BTC/BRL',
      price: toNumber(d.bid),
      changePct: toNumber(d.pctChange),
      currency: 'BRL',
      source: 'awesomeapi',
      time: d?.create_date || null,
    };
  } catch {
    return { name: 'Bitcoin', symbol: 'BTC/BRL', price: null, changePct: null, currency: 'BRL', source: 'awesomeapi', time: null };
  }
}

async function fetchFromBrapi(symbol: string, name: string, currency: string = 'USD'): Promise<Indicator> {
  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}`;
    const res = await fetch(url);
    const json = await res.json();
    const it = json?.results?.[0] || {};
    const price = toNumber(it?.regularMarketPrice);
    if (price != null) {
      return {
        name: it?.shortName || name,
        symbol,
        price,
        changePct: toNumber(it?.regularMarketChangePercent),
        currency: it?.currency || currency,
        source: 'brapi',
        time: it?.regularMarketTime || null,
      };
    }
  } catch {
    // Fallback to unavailable if brapi fails
  }
  return { name, symbol, price: null, changePct: null, currency, source: 'unavailable', time: null };
}

async function fetchFromStooq(stooqSymbol: string, name: string, symbol: string, currency: string = 'USD'): Promise<Indicator> {
  try {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`);
    const txt = await res.text();
    // Format: Symbol,Date,Open,High,Low,Close,Volume
    // Example: ^BVSP,2025-11-12,129000.00,130000.00,128500.00,129500.00,12345678
    const lines = txt.split('\n').slice(1).filter(Boolean);
    // Busca o último valor válido (ignora N/D)
    for (let i = lines.length - 1; i >= 0; i--) {
      const parts = lines[i].split(',');
      const close = toNumber(parts?.[5]);
      if (close != null) {
        return {
          name,
          symbol,
          price: close,
          changePct: null,
          currency,
          source: 'stooq',
          time: parts?.[1] || null,
        };
      }
    }
  } catch {
    // Fallback to unavailable if stooq fails
  }
  return { name, symbol, price: null, changePct: null, currency, source: 'unavailable', time: null };
}

async function fetchIndexWithFallback(symbol: string, name: string, stooqSymbol: string, currency: string = 'USD'): Promise<Indicator> {
  // 1) Try brapi first (supports multiple indices including US)
  const brapiResult = await fetchFromBrapi(symbol, name, currency);
  if (brapiResult.price != null) {
    return brapiResult;
  }
  
  // 2) Fallback to Stooq
  return fetchFromStooq(stooqSymbol, name, symbol, currency);
}

export async function fetchIbovespa(): Promise<Indicator> {
  return fetchIndexWithFallback('IBOV', 'Ibovespa', '%5Ebvsp', 'BRL');
}

export async function fetchSP500(): Promise<Indicator> {
  return fetchIndexWithFallback('^GSPC', 'S&P 500', '%5Espx', 'USD');
}

export async function fetchDowJones(): Promise<Indicator> {
  return fetchIndexWithFallback('^DJI', 'Dow Jones', '%5Edji', 'USD');
}

export async function fetchNasdaq(): Promise<Indicator> {
  return fetchIndexWithFallback('^NDX', 'Nasdaq 100', '%5Endx', 'USD');
}

export async function fetchAllIndicators(): Promise<Indicator[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  // 1) Try via supabase-js invoke (handles headers/JWT correctly)
  if (supabaseUrl && supabaseKey) {
    // 1a) First, try a simple GET to the Functions domain WITHOUT custom headers
    // to avoid a CORS preflight (some deployments block OPTIONS when not deployed/configured yet).
    try {
      let functionUrl: string;
      try {
        const u = new URL(supabaseUrl);
        const projectRef = u.hostname.split(".")[0];
        functionUrl = `https://${projectRef}.functions.supabase.co/market-indicators`;
      } catch {
        functionUrl = `${supabaseUrl}/functions/v1/market-indicators`;
      }
      const res = await fetch(functionUrl, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const arr = Array.isArray(json?.indicators) ? json.indicators : [];
        return arr.map((x: RawIndicator) => ({
          name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
        }));
      }
    } catch {
      // Ignore errors and try next method
    }

    try {
      const { data, error } = await supabase.functions.invoke('market-indicators', {
        // prevent cached responses during dev
        headers: { 'cache-control': 'no-cache' },
      });
      if (!error && data && Array.isArray((data as {indicators?: RawIndicator[]}).indicators)) {
        const arr = (data as {indicators: RawIndicator[]}).indicators;
        return arr.map((x: RawIndicator) => ({
          name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
        }));
      }
    } catch {
      // Ignore errors and try next method
    }

    // 1c) Manual call to functions domain WITH headers as a fallback
    try {
      // Prefer the dedicated Functions domain to avoid proxy/CORS quirks
      // https://<project-ref>.functions.supabase.co/<function-name>
      let functionUrl: string;
      try {
        const u = new URL(supabaseUrl);
        const projectRef = u.hostname.split(".")[0];
        functionUrl = `https://${projectRef}.functions.supabase.co/market-indicators`;
      } catch {
        // Fallback to classic path if URL parsing fails
        functionUrl = `${supabaseUrl}/functions/v1/market-indicators`;
      }

      const res = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        // Avoid cached CDN responses during dev
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        const arr = Array.isArray(json?.indicators) ? json.indicators : [];
        // Normaliza tipos
        return arr.map((x: RawIndicator) => ({
          name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
        }));
      }
    } catch {
      // Ignore errors, will use client-side fallback
    }
  }
  // Fallback client-side
  const [ibov, usd, btc, sp500, dowJones, nasdaq] = await Promise.all([
    fetchIbovespa(),
    fetchUsdBrl(),
    fetchBtcBrl(),
    fetchSP500(),
    fetchDowJones(),
    fetchNasdaq(),
  ]);
  return [ibov, usd, btc, sp500, dowJones, nasdaq];
}
