import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import type { ReportService } from './service.js';

export function createHttpApp(service: ReportService, token: string, allowedHosts = ['localhost', '127.0.0.1', '[::1]'], allowedOrigin?: string) {
  if (token.length < 32) throw new Error('HTTP mode requires ZURI_HTTP_TOKEN containing at least 32 random characters.');
  if (service.options.allowPaths) throw new Error('HTTP mode must disable local file access.');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    let host = '';
    try { host = new URL(`http://${req.headers.host ?? ''}`).hostname; } catch { /* reject below */ }
    if (!allowedHosts.includes(host)) { res.status(403).json({ error: 'Host not allowed.' }); return; }
    if (req.headers.origin && req.headers.origin !== allowedOrigin) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const actual = Buffer.from(req.headers.authorization ?? ''), expected = Buffer.from(`Bearer ${token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { res.status(401).json({ error: 'Bearer authentication required.' }); return; }
    next();
  });
  app.use(express.json({ limit: '21mb' }));
  let active = 0;
  app.post('/mcp', async (req, res) => {
    if (active >= 4) { res.status(429).json({ error: 'Too many concurrent requests.' }); return; }
    active++;
    const server = createServer(service);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { active--; void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch { if (!res.headersSent) res.status(500).json({ error: 'MCP request failed.' }); }
  });
  app.all('/mcp', (_req, res) => { res.status(405).end(); });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status((error as { status?: number }).status === 413 ? 413 : 400).json({ error: 'Invalid or oversized request body.' });
  });
  return app;
}
