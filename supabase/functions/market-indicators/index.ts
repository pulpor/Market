import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

type Indicator = {
  name: string;
  symbol: string;
  price: number | null;
  changePct: number | null;
  currency?: string;
  source: string;
  time: string | number | null;
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? (n as number) : null;
}

async function getIbov(): Promise<Indicator> {
  // 1) Yahoo quote (server-side, sem CORS)
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EBVSP', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const j = await r.json();
    const it = j?.quoteResponse?.result?.[0] || {};
    return {
      name: 'Ibovespa',
      symbol: 'IBOV',
      price: toNum(it?.regularMarketPrice),
      changePct: toNum(it?.regularMarketChangePercent),
      currency: it?.currency || 'BRL',
      source: 'yahoo',
      time: it?.regularMarketTime || null,
    };
  } catch {}

  // 1b) Yahoo chart fallback (deriva preço e variação pelo previousClose)
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?range=1d&interval=1m', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta || {};
    const price = toNum(meta?.regularMarketPrice);
    const prev = toNum(meta?.previousClose ?? meta?.chartPreviousClose);
    const changePct = price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null;
    if (price != null) {
      return {
        name: 'Ibovespa', symbol: 'IBOV', price, changePct, currency: meta?.currency || 'BRL', source: 'yahoo-chart', time: meta?.regularMarketTime || null
      };
    }
  } catch {}

  // 1c) Stooq CSV fallback (busca último valor válido, ignora N/D)
  try {
    const r = await fetch('https://stooq.com/q/d/l/?s=%5Ebvsp&i=d');
    const txt = await r.text();
    // Symbol,Date,Open,High,Low,Close,Volume\n^BVSP,2025-11-12,....
    const lines = txt.split('\n').slice(1).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const parts = lines[i].split(',');
      const close = toNum(parts?.[5]);
      if (close != null) {
        return { name: 'Ibovespa', symbol: 'IBOV', price: close, changePct: null, currency: 'BRL', source: 'stooq', time: parts?.[1] || null };
      }
    }
  } catch {}

  // 2) Fallback brapi
  try {
    const r = await fetch('https://brapi.dev/api/quote/%5EBVSP');
    const j = await r.json();
    const it = j?.results?.[0] || {};
    return {
      name: 'Ibovespa',
      symbol: 'IBOV',
      price: toNum(it?.regularMarketPrice),
      changePct: toNum(it?.regularMarketChangePercent),
      currency: 'BRL',
      source: 'brapi',
      time: it?.regularMarketTime || null,
    };
  } catch {}

  return { name: 'Ibovespa', symbol: 'IBOV', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

async function getYahooIndex(symbol: string, name: string): Promise<Indicator> {
  try {
    const enc = encodeURIComponent(symbol);
    const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${enc}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const j = await r.json();
    const it = j?.quoteResponse?.result?.[0] || {};
    return {
      name,
      symbol,
      price: toNum(it?.regularMarketPrice),
      changePct: toNum(it?.regularMarketChangePercent),
      currency: it?.currency || 'USD',
      source: 'yahoo',
      time: it?.regularMarketTime || null,
    };
  } catch {}

  // Yahoo chart fallback
  try {
    const enc = encodeURIComponent(symbol);
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1d&interval=1m`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta || {};
    const price = toNum(meta?.regularMarketPrice);
    const prev = toNum(meta?.previousClose ?? meta?.chartPreviousClose);
    const changePct = price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null;
    if (price != null) {
      return { name, symbol, price, changePct, currency: meta?.currency || 'USD', source: 'yahoo-chart', time: meta?.regularMarketTime || null };
    }
  } catch {}

  // Stooq CSV fallback (busca último valor válido, ignora N/D)
  try {
    const map: Record<string, string> = {
      '^GSPC': '%5Espx',
      '^DJI': '%5Edji',
      '^NDX': '%5Endx',
    };
    const q = map[symbol] || '';
    if (q) {
      const r = await fetch(`https://stooq.com/q/d/l/?s=${q}&i=d`);
      const txt = await r.text();
      const lines = txt.split('\n').slice(1).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const parts = lines[i].split(',');
        const close = toNum(parts?.[5]);
        if (close != null) {
          return { name, symbol, price: close, changePct: null, currency: 'USD', source: 'stooq', time: parts?.[1] || null };
        }
      }
    }
  } catch {}

  return { name, symbol, price: null, changePct: null, currency: 'USD', source: 'unavailable', time: null };
}

async function getUsdBrl(): Promise<Indicator> {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const j = await r.json();
    const d = j?.USDBRL || {};
    return {
      name: 'Dólar', symbol: 'USD/BRL', price: toNum(d.bid), changePct: toNum(d.pctChange), currency: 'BRL', source: 'awesomeapi', time: d?.create_date || null
    };
  } catch {}
  return { name: 'Dólar', symbol: 'USD/BRL', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

async function getBtcBrl(): Promise<Indicator> {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/BTC-BRL');
    const j = await r.json();
    const d = j?.BTCBRL || {};
    return {
      name: 'Bitcoin', symbol: 'BTC/BRL', price: toNum(d.bid), changePct: toNum(d.pctChange), currency: 'BRL', source: 'awesomeapi', time: d?.create_date || null
    };
  } catch {}
  return { name: 'Bitcoin', symbol: 'BTC/BRL', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const [ibov, usd, btc, sp, djia, ndx] = await Promise.all([
      getIbov(),
      getUsdBrl(),
      getBtcBrl(),
      getYahooIndex('^GSPC', 'S&P 500'),
      getYahooIndex('^DJI', 'Dow Jones'),
      getYahooIndex('^NDX', 'Nasdaq 100'),
    ]);
    return new Response(JSON.stringify({ indicators: [ibov, usd, btc, sp, djia, ndx] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'market-indicators failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
