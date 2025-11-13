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

app.listen(PORT, () => {
  console.log(`🔒 Servidor de storage rodando em http://localhost:${PORT}`);
  console.log(`📁 Arquivo: ${ASSETS_FILE}`);
});
