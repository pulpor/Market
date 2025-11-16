/**
 * Real-time Market Gateway (Socket.IO)
 * 
 * Assina o canal Redis "market:updates" e distribui via Socket.IO
 * para todos os clientes conectados (navegadores).
 * 
 * Arquitetura:
 * Collector → Redis Pub/Sub → Gateway → Socket.IO → Frontend
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import express from 'express';
import cors from 'cors';

// Configuração
const PORT = process.env.GATEWAY_PORT || 3003;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8080', 'http://localhost:8081', 'https://pulpor-market.vercel.app'];

// Express + HTTP server
const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));

const httpServer = createServer(app);

// Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'], // WebSocket preferido, polling fallback
});

// Redis clients (precisa de 2: um para pub/sub, outro para operações normais)
let redisSubscriber;
let redisClient;

// Cache dos últimos valores (para enviar snapshot ao conectar)
const marketCache = new Map();

/**
 * Inicializa Redis
 */
async function initRedis() {
  // Cliente para pub/sub
  redisSubscriber = createClient({ url: REDIS_URL });
  redisSubscriber.on('error', (err) => console.error('❌ Redis subscriber error:', err));
  await redisSubscriber.connect();
  
  // Cliente para operações normais
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', (err) => console.error('❌ Redis client error:', err));
  await redisClient.connect();
  
  console.log('✅ Redis connected');
  
  // Assinar canal de atualizações
  await redisSubscriber.subscribe('market:updates', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Atualizar cache
      marketCache.set(data.symbol, data);
      
      // Broadcast para todos os clientes Socket.IO
      io.emit('market:update', data);
      
      console.log(`📡 Broadcast: ${data.symbol} @ ${data.price.toFixed(2)}`);
    } catch (error) {
      console.error('❌ Message parse error:', error);
    }
  });
  
  console.log('✅ Subscribed to Redis channel: market:updates');
}

/**
 * Socket.IO event handlers
 */
io.on('connection', (socket) => {
  const clientId = socket.id.substring(0, 8);
  console.log(`🔗 Client connected: ${clientId} (${io.engine.clientsCount} total)`);
  
  // Enviar snapshot dos valores em cache ao conectar
  if (marketCache.size > 0) {
    const snapshot = Array.from(marketCache.values());
    socket.emit('market:snapshot', snapshot);
    console.log(`📸 Sent snapshot to ${clientId}: ${snapshot.length} symbols`);
  }
  
  // Heartbeat (ping/pong) para manter conexão ativa
  const heartbeatInterval = setInterval(() => {
    socket.emit('heartbeat', { timestamp: Date.now() });
  }, 30000); // 30s
  
  socket.on('disconnect', (reason) => {
    clearInterval(heartbeatInterval);
    console.log(`❌ Client disconnected: ${clientId} (reason: ${reason})`);
  });
  
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${clientId}:`, error);
  });
});

/**
 * REST endpoint para health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: io.engine.clientsCount,
    cachedSymbols: marketCache.size,
    uptime: process.uptime(),
  });
});

/**
 * REST endpoint para obter snapshot (para clientes sem WebSocket)
 */
app.get('/api/market/snapshot', (req, res) => {
  const snapshot = Array.from(marketCache.values());
  res.json({ success: true, data: snapshot });
});

/**
 * Main
 */
async function main() {
  console.log('🚀 Starting Real-time Market Gateway...\n');
  
  await initRedis();
  
  httpServer.listen(PORT, () => {
    console.log(`🌐 Gateway running on http://localhost:${PORT}`);
    console.log(`   Socket.IO: ws://localhost:${PORT}`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('\n✅ Gateway is ready. Waiting for clients...\n');
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  
  io.close();
  if (redisSubscriber) await redisSubscriber.quit();
  if (redisClient) await redisClient.quit();
  
  process.exit(0);
});

main().catch(console.error);
