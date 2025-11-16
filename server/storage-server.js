import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const ASSETS_FILE = path.join(__dirname, '../assets.json');

app.use(cors());
app.use(express.json());

// Endpoint para carregar os ativos
app.get('/api/assets', async (req, res) => {
  try {
    const data = await fs.readFile(ASSETS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Arquivo não existe, retorna vazio
      const emptyData = { assets: [], lastUpdated: new Date().toISOString(), version: '1.0' };
      await fs.writeFile(ASSETS_FILE, JSON.stringify(emptyData, null, 2));
      res.json(emptyData);
    } else {
      res.status(500).json({ error: 'Erro ao ler arquivo' });
    }
  }
});

// Endpoint para salvar os ativos
app.post('/api/assets', async (req, res) => {
  try {
    const data = {
      assets: req.body.assets || [],
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    await fs.writeFile(ASSETS_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, message: 'Ativos salvos com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar arquivo' });
  }
});

// Proxy simples para indicadores de mercado (evita CORS no browser)
app.get('/api/market/ibov', async (req, res) => {
  try {
    // Fonte 1: brapi (^BVSP)
    const url = 'https://brapi.dev/api/quote/%5EBVSP';
    const r = await fetch(url);
    if (!r.ok) throw new Error('brapi not ok');
    const j = await r.json();
    const it = j?.results?.[0] || {};
    const payload = {
      name: it?.shortName || 'Ibovespa',
      symbol: 'IBOV',
      price: Number(it?.regularMarketPrice ?? NaN),
      changePct: Number(it?.regularMarketChangePercent ?? NaN),
      currency: 'BRL',
      source: 'brapi',
      time: it?.regularMarketTime || null,
    };
    return res.json(payload);
  } catch (e) {
    // Fallback 2: Yahoo Finance (pode falhar em alguns ambientes)
    try {
      const yurl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EBVSP';
      const ry = await fetch(yurl);
      const jy = await ry.json();
      const it = jy?.quoteResponse?.result?.[0] || {};
      const payload = {
        name: it?.shortName || 'Ibovespa',
        symbol: 'IBOV',
        price: Number(it?.regularMarketPrice ?? NaN),
        changePct: Number(it?.regularMarketChangePercent ?? NaN),
        currency: it?.currency || 'BRL',
        source: 'yahoo',
        time: it?.regularMarketTime || null,
      };
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: 'Falha ao obter IBOV' });
    }
  }
});

// Helpers para índices dos EUA
async function fetchYahooIndex(symbol, name) {
  // 1) Yahoo quote
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
      price: Number(it?.regularMarketPrice ?? NaN),
      changePct: Number(it?.regularMarketChangePercent ?? NaN),
      currency: it?.currency || 'USD',
      source: 'yahoo',
      time: it?.regularMarketTime || null,
    };
  } catch {}

  // 2) Yahoo chart fallback (deriva variação pelo previousClose)
  try {
    const enc = encodeURIComponent(symbol);
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1d&interval=1m`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta || {};
    const price = Number(meta?.regularMarketPrice ?? NaN);
    const prev = Number(meta?.previousClose ?? meta?.chartPreviousClose ?? NaN);
    const changePct = Number.isFinite(price) && Number.isFinite(prev) && prev !== 0 ? ((price - prev) / prev) * 100 : null;
    if (Number.isFinite(price)) {
      return { name, symbol, price, changePct, currency: meta?.currency || 'USD', source: 'yahoo-chart', time: meta?.regularMarketTime || null };
    }
  } catch {}

  // 3) Stooq CSV fallback (último fechamento válido)
  try {
    const map = { '^GSPC': '%5Espx', '^DJI': '%5Edji', '^NDX': '%5Endx' };
    const q = map[symbol];
    if (q) {
      const r = await fetch(`https://stooq.com/q/d/l/?s=${q}&i=d`);
      const txt = await r.text();
      const lines = txt.split('\n').slice(1).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const parts = lines[i].split(',');
        const close = Number(parts?.[5] ?? NaN);
        if (Number.isFinite(close)) {
          return { name, symbol, price: close, changePct: null, currency: 'USD', source: 'stooq', time: parts?.[1] || null };
        }
      }
    }
  } catch {}

  return { name, symbol, price: null, changePct: null, currency: 'USD', source: 'unavailable', time: null };
}

app.get('/api/market/sp500', async (req, res) => {
  const result = await fetchYahooIndex('^GSPC', 'S&P 500');
  if (result.price == null) return res.status(502).json(result);
  return res.json(result);
});

app.get('/api/market/djia', async (req, res) => {
  const result = await fetchYahooIndex('^DJI', 'Dow Jones');
  if (result.price == null) return res.status(502).json(result);
  return res.json(result);
});

app.get('/api/market/ndx', async (req, res) => {
  const result = await fetchYahooIndex('^NDX', 'Nasdaq 100');
  if (result.price == null) return res.status(502).json(result);
  return res.json(result);
});

app.listen(PORT, () => {
  console.log(`🔒 Servidor de storage rodando em http://localhost:${PORT}`);
  console.log(`📁 Arquivo: ${ASSETS_FILE}`);
});
