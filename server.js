/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
// ============================================================
// RazorRecon AI — Custom Server with WebSocket Support
// Wraps Next.js with ws for bidirectional real-time comms
// ============================================================
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track connected clients
const clients = new Set();
let heartbeatInterval = null;
const startTime = Date.now();

app.prepare().then(() => {
  require('ts-node').register({ 
    transpileOnly: true,
    compilerOptions: {
      module: 'CommonJS',
      moduleResolution: 'node'
    }
  });
  const { initSchema } = require('./src/lib/db.ts');
  initSchema().then(() => console.log('[DB] Schema initialized successfully')).catch(console.error);

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server on /ws path
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // Don't destroy other upgrade connections — Next.js HMR needs them
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    // Send welcome message with system state
    ws.send(JSON.stringify({
      channel: 'system:heartbeat',
      data: {
        type: 'connected',
        clients: clients.size,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        message: 'Connected to RazorRecon real-time feed'
      },
      timestamp: new Date().toISOString(),
      id: `ws_welcome_${Date.now()}`
    }));

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // Broadcast function available globally
  global.__wsBroadcast = (event) => {
    const data = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try { client.send(data); } catch (e) { /* ignore */ }
      }
    }
  };

  global.__wsStats = () => ({
    connectedClients: clients.size,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });

  // Event bus <-> WebSocket bridge:
  // API routes already call global.__wsBroadcast() directly when emitting events.
  // No additional bridging needed here.

  // System heartbeat every 5 seconds
  heartbeatInterval = setInterval(() => {
    const event = {
      channel: 'system:heartbeat',
      data: {
        type: 'pulse',
        clients: clients.size,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      id: `hb_${Date.now()}`
    };
    const data = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === 1) {
        try { client.send(data); } catch (e) { /* ignore */ }
      }
    }
  }, 5000);

  server.listen(port, hostname, () => {
    console.log(`\n  ┌──────────────────────────────────────────────┐`);
    console.log(`  │                                              │`);
    console.log(`  │   ⚡ RazorRecon AI — Enterprise Platform     │`);
    console.log(`  │                                              │`);
    console.log(`  │   HTTP:  http://localhost:${port}               │`);
    console.log(`  │   WS:    ws://localhost:${port}/ws               │`);
    console.log(`  │   Mode:  ${dev ? 'Development' : 'Production'}                      │`);
    console.log(`  │                                              │`);
    console.log(`  └──────────────────────────────────────────────┘\n`);
  });
});
