import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CityClient } from './city.js';
import { Store } from './store.js';
import { ReportService } from './service.js';
import { createServer } from './server.js';
import { createHttpApp } from './http.js';

export async function runCli(args = process.argv.slice(2)) {
  const mode = args[0] ?? 'stdio';
  if (mode === '--help' || mode === 'help') {
    console.log('zueri-wie-neu-mcp [stdio | http | telegram | doctor]\nDefault: stdio. See README.md for installation and experimental submission opt-in.'); return;
  }
  if (!['stdio', 'http', 'telegram', 'doctor'].includes(mode)) throw new Error('Unknown command. Use --help.');
  const city = new CityClient();
  if (mode === 'doctor') {
    const [categories, rules, candidates, recent] = await Promise.all([
      city.categories(), city.requirements({ latitude: 47.370183, longitude: 8.535284 }),
      city.geocode('Basteiplatz Zürich'), city.reports({ limit: 1 }),
    ]);
    let rejectsOutsideCity = false;
    try { await city.requirements({ latitude: 46.948, longitude: 7.4474 }); }
    catch (error) { if (error instanceof Error && error.message.startsWith('Location rejected by the city:')) rejectsOutsideCity = true; else throw error; }
    if (!rejectsOutsideCity) throw new Error('City boundary rejection check failed.');
    const publicReport = recent[0] ? await city.reports({ id: recent[0].service_request_id }) : [];
    console.log(JSON.stringify({ ok: true, categories: categories.length, validated_location: 'Basteiplatz, Zürich',
      geocoding_candidates: candidates.length, outside_city_rejected: rejectsOutsideCity,
      public_report_lookup: publicReport[0]?.service_request_id ?? 'No recent public report to check',
      live_rules: rules, submission_enabled: process.env.ZURI_ENABLE_SUBMISSION === 'true',
      note: 'Read-only connectivity check. Submission has not been tested against the live city system.' }, null, 2)); return;
  }
  const directory = resolve(process.env.ZURI_DATA_DIR ?? join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'zueri-wie-neu-mcp'));
  const store = new Store(directory);
  await store.cleanup();
  const service = new ReportService(city, store, { submissionEnabled: process.env.ZURI_ENABLE_SUBMISSION === 'true', allowPaths: mode === 'stdio' });
  if (mode === 'telegram') {
    const { startTelegram } = await import('./telegram.js');
    await startTelegram(service); return;
  }
  if (mode === 'stdio') {
    const server = createServer(service);
    await server.connect(new StdioServerTransport());
  } else {
    const host = process.env.ZURI_HOST ?? '127.0.0.1';
    const port = Number(process.env.ZURI_PORT ?? '3211');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ZURI_PORT.');
    const allowedHosts = process.env.ZURI_ALLOWED_HOSTS?.split(',').map(s => s.trim()).filter(Boolean);
    if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !allowedHosts?.length) throw new Error('Non-local binding requires an explicit ZURI_ALLOWED_HOSTS list.');
    const app = createHttpApp(service, process.env.ZURI_HTTP_TOKEN ?? '', allowedHosts, process.env.ZURI_ALLOWED_ORIGIN);
    const listener = app.listen(port, host, () => { console.error(`Zürich MCP listening on ${host}:${port}/mcp (single user, authenticated).`); });
    listener.on('error', () => { console.error('Could not start HTTP listener.'); process.exitCode = 1; });
    const stop = () => { listener.close(); listener.closeIdleConnections(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  }
}
