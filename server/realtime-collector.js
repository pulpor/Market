/**
 * Real-time Market Data Collector (SEM REDIS - Grátis!)
 * 
 * Conecta a múltiplas fontes via WebSocket/REST:
 * - Binance WebSocket: BTC/USDT real-time
 * - AwesomeAPI: USD/BRL (polling)
 * - Brapi: IBOVESPA (polling)
 * - Yahoo Finance: Índices US (polling)
 * 
 * Distribui via Server-Sent Events (SSE) direto aos clientes
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';

// Configuração
const PORT = process.env.COLLECTOR_PORT || 3002;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8080', 'http://localhost:8081', 'https://pulpor-market.vercel.app'];

// Cache de últimos valores
const marketCache = new Map();

// Clientes SSE conectados
const sseClients = new Set();

// WebSocket connections
let binanceWs;

function getUsdRate() {
  const usd = marketCache.get('USD');
  return usd && typeof usd.price === 'number' ? usd.price : undefined;
}

/**
 * Normaliza dados para formato padrão
 */
function normalizeMarketData(symbol, price, change = 0, pctChange = 0) {
  return {
    symbol,
    price: parseFloat(price),
    change: parseFloat(change),
    pctChange: parseFloat(pctChange),
    timestamp: Date.now(),
  };
}

/**
 * Publica atualização via SSE para todos os clientes
 */
async function publishUpdate(data) {
  try {
    marketCache.set(data.symbol, data);
    
    // Envia para todos os clientes SSE conectados
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (err) {
        sseClients.delete(client);
      }
    });
    
    console.log(`📤 Broadcast: ${data.symbol} @ ${data.price.toFixed(2)} (${data.pctChange >= 0 ? '+' : ''}${data.pctChange.toFixed(2)}%) → ${sseClients.size} clients`);
  } catch (error) {
    console.error('❌ Broadcast error:', error);
  }
}

/**
 * Binance WebSocket - Bitcoin real-time
 */
function connectBinance() {
  const wsUrl = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
  
  binanceWs = new WebSocket(wsUrl);
  
  let last24hPrice = null;
  
  binanceWs.on('open', () => {
    console.log('✅ Binance WebSocket connected');
    
    // Buscar preço de 24h atrás para calcular variação
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(res => res.json())
      .then(data => {
        last24hPrice = parseFloat(data.openPrice);
      })
      .catch(err => console.warn('⚠️ Binance 24h data error:', err));
  });
  
  binanceWs.on('message', (data) => {
    try {
      const trade = JSON.parse(data);
      const currentPrice = parseFloat(trade.p);
      
      const usd = getUsdRate();
      const priceOut = usd ? currentPrice * usd : currentPrice;
      if (last24hPrice) {
        const change = currentPrice - last24hPrice;
        const pctChange = (change / last24hPrice) * 100;
        const changeOut = usd ? change * usd : change;
        publishUpdate(normalizeMarketData('BTC', priceOut, changeOut, pctChange));
      } else {
        publishUpdate(normalizeMarketData('BTC', priceOut, 0, 0));
      }
    } catch (error) {
      console.error('❌ Binance message error:', error);
    }
  });
  
  binanceWs.on('error', (error) => {
    console.error('❌ Binance WebSocket error:', error);
  });
  
  binanceWs.on('close', () => {
    console.warn('⚠️ Binance WebSocket closed. Reconnecting in 5s...');
    setTimeout(connectBinance, 5000);
  });
}

/**
 * Polling - USD/BRL (AwesomeAPI)
 */
async function pollUSDBRL() {
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await response.json();
    
    const price = parseFloat(data.USDBRL.bid);
    const pctChange = parseFloat(data.USDBRL.pctChange);
    const change = (price * pctChange) / 100;
    
    publishUpdate(normalizeMarketData('USD', price, change, pctChange));
  } catch (error) {
    console.error('❌ USD/BRL polling error:', error);
  }
}

/**
 * Polling - IBOVESPA (Yahoo + Brapi + AwesomeAPI fallbacks)
 */
async function pollIBOVESPA() {
  try {
    // 1) Tenta Yahoo Finance
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d&range=1d`;
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      const price = meta?.regularMarketPrice;
      const prevClose = meta?.chartPreviousClose || meta?.previousClose;
      if (price && prevClose) {
        const change = price - prevClose;
        const pctChange = (change / prevClose) * 100;
        publishUpdate(normalizeMarketData('IBOV', price, change, pctChange));
        console.log(`✅ IBOV (Yahoo): ${price.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`);
        return;
      }
      console.warn('⚠️ Yahoo retornou dados incompletos para IBOV');
    } catch (e) {
      console.warn(`⚠️ Yahoo IBOV falhou: ${e.message}`);
    }

    // 2) Fallback para Brapi
    try {
      const response = await fetch('https://brapi.dev/api/quote/%5EBVSP?range=1d&interval=1d');
      if (!response.ok) throw new Error(`Brapi HTTP ${response.status}`);
      const data = await response.json();
      if (data.results && data.results[0]) {
        const r = data.results[0];
        const price = r.regularMarketPrice;
        const change = r.regularMarketChange;
        const pctChange = r.regularMarketChangePercent;
        if (price && typeof change === 'number' && typeof pctChange === 'number') {
          publishUpdate(normalizeMarketData('IBOV', price, change, pctChange));
          console.log(`✅ IBOV (Brapi): ${price.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`);
          return;
        }
      }
      console.warn('⚠️ Brapi retornou dados incompletos para IBOV');
    } catch (e) {
      console.warn(`⚠️ Brapi IBOV falhou: ${e.message}`);
    }

    // 3) Fallback para AwesomeAPI (IBOV-BRL)
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/json/last/IBOV-BRL');
      if (!response.ok) throw new Error(`AwesomeAPI HTTP ${response.status}`);
      const data = await response.json();
      const ibov = data?.IBOVBRL;
      if (ibov) {
        const price = parseFloat(ibov.bid);
        const pctChange = parseFloat(ibov.pctChange);
        const change = (price * pctChange) / 100;
        if (!isNaN(price) && !isNaN(pctChange)) {
          publishUpdate(normalizeMarketData('IBOV', price, change, pctChange));
          console.log(`✅ IBOV (AwesomeAPI): ${price.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`);
          return;
        }
      }
      console.warn('⚠️ AwesomeAPI retornou dados incompletos para IBOV');
    } catch (e) {
      console.warn(`⚠️ AwesomeAPI IBOV falhou: ${e.message}`);
    }

    console.error('❌ IBOVESPA: Todas as fontes falharam!');
  } catch (error) {
    console.error('❌ IBOVESPA polling error:', error.message || error);
  }
}

/**
 * Polling - Índices US via Yahoo Finance
 */
async function pollUSIndices() {
  try {
    const symbols = [
      { yahoo: '^GSPC', our: 'SP500', name: 'S&P 500' },
      { yahoo: '^DJI', our: 'DOW', name: 'Dow Jones' },
      { yahoo: '^IXIC', our: 'NASDAQ', name: 'Nasdaq' },
    ];
    
    for (const { yahoo, our } of symbols) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?interval=1d&range=1d`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await response.json();
        
        if (data?.chart?.result?.[0]) {
          const result = data.chart.result[0];
          const meta = result.meta;
          let price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose;
          
          if (price && prevClose) {
            let change = price - prevClose;
            const pctChange = (change / prevClose) * 100;
            const usd = getUsdRate();
            if (usd) {
              price = price * usd;
              change = change * usd;
            }
            publishUpdate(normalizeMarketData(our, price, change, pctChange));
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
      } catch (err) {
        console.warn(`⚠️ ${our} error:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ US indices polling error:', error);
  }
}

/**
 * Polling para dados sem WebSocket
 */
async function startPolling() {
  // Polling inicial
  await pollUSDBRL();
  await pollIBOVESPA();
  await pollUSIndices();
  
  // Intervalos
  setInterval(pollUSDBRL, 5000);      // USD/BRL a cada 5s
  setInterval(pollIBOVESPA, 10000);   // IBOVESPA a cada 10s
  setInterval(pollUSIndices, 15000);  // Índices US a cada 15s
}

/**
 * Express server para SSE e REST snapshot
 */
function startHttpServer() {
  const app = express();
  app.use(cors({ origin: ALLOWED_ORIGINS }));
  
  // SSE endpoint - real-time stream
  app.get('/api/market/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Enviar snapshot inicial
    const snapshot = Array.from(marketCache.values());
    res.write(`data: ${JSON.stringify({ type: 'snapshot', data: snapshot })}\n\n`);
    
    // Adicionar cliente à lista
    sseClients.add(res);
    console.log(`🔗 Client connected via SSE (${sseClients.size} total)`);
    
    // Heartbeat a cada 30s
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);
    
    // Cleanup ao desconectar
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
      console.log(`❌ Client disconnected (${sseClients.size} remaining)`);
    });
  });
  
  // REST endpoint - snapshot
  app.get('/api/market/snapshot', (req, res) => {
    const snapshot = Array.from(marketCache.values());
    res.json({ success: true, data: snapshot });
  });
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      clients: sseClients.size,
      cachedSymbols: marketCache.size,
      uptime: process.uptime(),
    });
  });
  
  app.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`   SSE Stream: http://localhost:${PORT}/api/market/stream`);
    console.log(`   Snapshot: http://localhost:${PORT}/api/market/snapshot`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  });
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Starting Real-time Market Collector (SSE - No Redis)...\n');
  
  // Iniciar servidor HTTP/SSE
  startHttpServer();
  
  // Conectar WebSockets
  connectBinance();
  
  // Iniciar polling
  await startPolling();
  
  console.log('\n✅ Collector is running. Streaming via SSE to clients.\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  
  if (binanceWs) binanceWs.close();
  
  process.exit(0);
});

main().catch(console.error);
