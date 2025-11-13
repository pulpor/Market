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

function toNumber(v: any): number | null {
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

export async function fetchIbovespa(): Promise<Indicator> {
  // Consulta direta ao brapi (pode exigir token e falhar por CORS; é apenas fallback do fallback)
  try {
    const url = 'https://brapi.dev/api/quote/%5EBVSP';
    const res = await fetch(url);
    const json = await res.json();
    const it = json?.results?.[0] || {};
    return {
      name: it?.shortName || 'Ibovespa',
      symbol: 'IBOV',
      price: toNumber(it?.regularMarketPrice),
      changePct: toNumber(it?.regularMarketChangePercent),
      currency: 'BRL',
      source: 'brapi',
      time: it?.regularMarketTime || null,
    };
  } catch {}

  return { name: 'Ibovespa', symbol: 'IBOV', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
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
        return arr.map((x: any) => ({
          name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
        }));
      }
    } catch {}

    try {
      const { data, error } = await supabase.functions.invoke('market-indicators', {
        // prevent cached responses during dev
        headers: { 'cache-control': 'no-cache' },
      });
      if (!error && data && Array.isArray((data as any).indicators)) {
        const arr = (data as any).indicators;
        return arr.map((x: any) => ({
          name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
        }));
      }
    } catch {}

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
        return arr.map((x: any) => ({
          name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
        }));
      }
    } catch {}
  }
  // Fallback client-side
  const [ibov, usd, btc] = await Promise.all([fetchIbovespa(), fetchUsdBrl(), fetchBtcBrl()]);
  return [ibov, usd, btc];
}
