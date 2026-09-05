/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Wraps Next.js with ws for bidirectional real-time comms
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
  const { getDb } = require('./src/lib/db.ts');
  const { seedDatabase } = require('./src/lib/seed.ts');
  const { startSimulator } = require('./src/lib/live-simulator.ts');
  const { runReconciliation } = require('./src/lib/reconciliation-engine.ts');

  initSchema()
    .then(async () => {
      console.log('[DB] Schema initialized successfully');

      // Auto-seed realistic data on startup (demo tenant only)
      try {
        const db = getDb();
        const result = await seedDatabase(db);
        if (result.alreadySeeded) {
          console.log(`[SEED] Database already seeded (${result.count} records)`);
        } else {
          console.log(`[SEED] ✅ Auto-seeded ${result.count} realistic Indian financial records`);
          
          // Run initial reconciliation on freshly seeded data
          try {
            const reconResult = await runReconciliation('tenant_demo_001');
            console.log(`[RECON] ✅ Initial reconciliation complete — ${reconResult.matchRate?.toFixed(1)}% match rate`);
          } catch (e) {
            console.error('[RECON] Initial reconciliation failed:', e.message);
          }
        }
      } catch (e) {
        console.error('[SEED] Auto-seed failed:', e.message);
      }

      // Auto-start live simulator for demo tenant (generates a new transaction every 5 seconds)
      try {
        startSimulator('tenant_demo_001', 5000); // Every 5 seconds
        console.log('[SIMULATOR] ✅ Live transaction simulator started (every 5s)');
      } catch (e) {
        console.error('[SIMULATOR] Failed to start:', e.message);
      }

      // NOTE: Per-user reconciliation runs on-demand via upload, manual trigger, or per-tenant simulator.
      // No global periodic reconciliation needed — each tenant is isolated.
    })
    .catch(console.error);

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/internal/ws-broadcast' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          if (global.__wsBroadcast) global.__wsBroadcast(JSON.parse(body));
        } catch(e) {}
        res.writeHead(200);
        res.end('ok');
      });
      return;
    }

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
  const { eventBus } = require('./src/lib/event-bus.ts');
  eventBus.subscribeAll((event) => {
    if (global.__wsBroadcast) {
      global.__wsBroadcast(event);
    }
  });

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
