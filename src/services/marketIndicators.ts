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

// Yahoo Finance via Vercel Edge Function (no CORS, server-side)
async function fetchYahooChartMeta(symbol: string): Promise<{ price: number | null; prevClose: number | null; timestamp: string | null; source: string }>{
  const proxyUrl = `/api/yahoo-proxy?symbol=${encodeURIComponent(symbol)}`;

  try {
    const res = await fetch(proxyUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.error) {
        console.warn(`⚠️ Yahoo ${symbol}: ${data.error}`);
        return { price: null, prevClose: null, timestamp: null, source: 'vercel-proxy' };
      }
      const timestamp = data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString();
      console.log(`✅ Yahoo ${symbol}: ${data.price}`);
      return {
        price: data.price ?? null,
        prevClose: data.prevClose ?? null,
        timestamp,
        source: 'vercel-proxy',
      };
    } else {
      console.warn(`⚠️ Yahoo proxy ${symbol}: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`❌ Yahoo proxy ${symbol} falhou:`, err);
  }

  return { price: null, prevClose: null, timestamp: null, source: 'vercel-proxy' };
}

async function fetchIbovespa(): Promise<Indicator> {
  console.log('📊 Buscando IBOV...');
  // 1) Yahoo (CORS geralmente liberado)
  // Corrige double-encoding: use '^BVSP' para que encodeURIComponent trate corretamente
  const y = await fetchYahooChartMeta('^BVSP');
  if (y.price != null && y.prevClose != null) {
    const change = y.price - y.prevClose;
    const pct = (change / y.prevClose) * 100;
    console.log(`✅ IBOV (Yahoo): ${y.price}`);
    return { name: 'Ibovespa', symbol: 'IBOV', price: y.price, changePct: pct, currency: 'BRL', source: y.source, time: y.timestamp };
  }
  // 2) Fallback: Brapi (pode falhar por CORS)
  console.log('🔄 IBOV: tentando Brapi...');
  try {
    const url = 'https://brapi.dev/api/quote/%5EBVSP';
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const it = json?.results?.[0] || {};
      const price = toNumber(it?.regularMarketPrice);
      const pct = toNumber(it?.regularMarketChangePercent);
      if (price !== null) {
        console.log(`✅ IBOV (Brapi): ${price}`);
        return { name: it?.shortName || 'Ibovespa', symbol: 'IBOV', price, changePct: pct, currency: 'BRL', source: 'brapi', time: it?.regularMarketTime || null };
      }
    }
  } catch (err) {
    console.error('❌ IBOV Brapi falhou:', err);
  }
  console.warn('⚠️ IBOV: todos os métodos falharam');
  return { name: 'Ibovespa', symbol: 'IBOV', price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

async function fetchYahooIndexToBRL(symbol: string, name: string, usdBrl: number | null): Promise<Indicator> {
  console.log(`📊 Buscando ${name} (${symbol})...`);
  const y = await fetchYahooChartMeta(symbol);
  if (y.price != null && y.prevClose != null) {
    const change = y.price - y.prevClose;
    const pct = (change / y.prevClose) * 100;
    const hasUsd = typeof usdBrl === 'number' && Number.isFinite(usdBrl as number);
    const priceBRL = hasUsd ? y.price * (usdBrl as number) : y.price;
    console.log(`✅ ${name}: USD ${y.price} → BRL ${priceBRL.toFixed(2)}`);
    return { name, symbol, price: priceBRL, changePct: pct, currency: 'BRL', source: y.source, time: y.timestamp };
  }
  console.warn(`⚠️ ${name} (${symbol}): sem dados`);
  return { name, symbol, price: null, changePct: null, currency: 'BRL', source: 'unavailable', time: null };
}

export async function fetchAllIndicators(): Promise<Indicator[]> {
  console.log('🌐 [marketIndicators.ts] fetchAllIndicators INICIADO - versão com logs');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  // 1) Try via supabase-js invoke (handles headers/JWT correctly)
  if (supabaseUrl && supabaseKey) {
    console.log('🔧 Tentando Supabase Function...');
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
      console.log('🔗 Tentando fetch simples:', functionUrl);
      const res = await fetch(functionUrl, { method: 'GET', cache: 'no-store' });
      console.log('📡 Resposta:', res.status, res.ok);
      if (res.ok) {
        const json = await res.json();
        const arr = Array.isArray(json?.indicators) ? json.indicators : [];
        console.log('✅ Function retornou', arr.length, 'indicadores:', arr.map((x: any) => `${x.symbol}=${x.price}`));
        
        // Verificar quantos indicadores têm preço válido
        const validCount = arr.filter((x: any) => toNumber(x.price) !== null).length;
        console.log(`📊 Indicadores válidos: ${validCount}/${arr.length}`);
        
        // Só usar a function se pelo menos 4 indicadores tiverem preço (USD, BTC + pelo menos 2 índices)
        if (validCount >= 4) {
          return arr.map((x: any) => ({
            name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
          }));
        }
        console.warn('⚠️ Function retornou dados incompletos, tentando fallback Yahoo...');
      }
    } catch (err) {
      console.error('❌ Fetch simples falhou:', err);
    }

    console.log('🔧 Tentando supabase.functions.invoke...');
    try {
      const { data, error } = await supabase.functions.invoke('market-indicators', {
        // prevent cached responses during dev
        headers: { 'cache-control': 'no-cache' },
      });
      console.log('📡 Invoke resposta:', { error, hasData: !!data, indicators: (data as any)?.indicators?.length });
      if (!error && data && Array.isArray((data as any).indicators)) {
        const arr = (data as any).indicators;
        const validCount = arr.filter((x: any) => toNumber(x.price) !== null).length;
        console.log(`✅ Invoke retornou ${arr.length} indicadores (${validCount} válidos)`);
        // Só usar se tiver pelo menos 4 válidos
        if (validCount >= 4) {
          return arr.map((x: any) => ({
            name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
          }));
        }
        console.warn('⚠️ Invoke retornou dados incompletos');
      }
    } catch (err) {
      console.error('❌ Invoke falhou:', err);
    }

    // 1c) Manual call to functions domain WITH headers as a fallback
    console.log('🔧 Tentando fetch manual com headers...');
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
          const validCount = arr.filter((x: any) => toNumber(x.price) !== null).length;
          console.log(`📡 Fetch manual: ${arr.length} indicadores (${validCount} válidos)`);
          // Só usar se tiver pelo menos 4 válidos
          if (validCount >= 4) {
            return arr.map((x: any) => ({
              name: x.name, symbol: x.symbol, price: toNumber(x.price), changePct: toNumber(x.changePct), currency: x.currency, source: x.source, time: x.time ?? null,
            }));
          }
          console.warn('⚠️ Fetch manual retornou dados incompletos');
      }
      } catch (err) {
        console.error('❌ Fetch manual falhou:', err);
      }
  }
  
    console.log('🌐 Todas as tentativas Supabase falharam ou retornaram dados incompletos. Usando Yahoo Finance...');
  // Fallback client-side (produção sem collector): usar Yahoo + AwesomeAPI com CORS aberto
  console.log('🌐 Iniciando fetch client-side de todos os indicadores...');
  const [usd, btc] = await Promise.all([fetchUsdBrl(), fetchBtcBrl()]);
  const usdRate = typeof usd.price === 'number' ? usd.price : null;
  console.log(`💵 USD/BRL: ${usdRate}`);
  
  const [ibov, sp, dj, ndx] = await Promise.all([
    fetchIbovespa(),
    fetchYahooIndexToBRL('^GSPC', 'S&P 500', usdRate),
    fetchYahooIndexToBRL('^DJI', 'Dow Jones', usdRate),
    fetchYahooIndexToBRL('^NDX', 'Nasdaq 100', usdRate),
  ]);
  
  console.log('📊 Indicadores carregados:', {
    ibov: ibov.price,
    usd: usd.price,
    btc: btc.price,
    sp: sp.price,
    dj: dj.price,
    ndx: ndx.price
  });
  
  return [ibov, usd, btc, sp, dj, ndx];
}
