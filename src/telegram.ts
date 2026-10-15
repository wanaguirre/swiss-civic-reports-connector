import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from './server.js';
import type { ReportService } from './service.js';
import { TelegramApi } from './telegram-api.js';
import { TelegramBot } from './telegram-bot.js';
import { draftWithCodex } from './telegram-draft.js';

export async function startTelegram(service: ReportService) {
  const api = new TelegramApi(process.env.ZURI_TELEGRAM_BOT_TOKEN ?? '');
  const userId = Number(process.env.ZURI_TELEGRAM_USER_ID);
  const ai = process.env.ZURI_TELEGRAM_AI ?? 'manual';
  if (!['manual', 'codex'].includes(ai))
    throw new Error('ZURI_TELEGRAM_AI must be manual or codex.');
  const server = createServer(service),
    client = new Client({ name: 'zurich-telegram', version: '0.4.0-rc.3' });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const bot = new TelegramBot(
      userId,
      api,
      async (name, args) => client.callTool({ name, arguments: args }) as any,
      ai === 'codex'
        ? (request) => draftWithCodex(request, process.env.ZURI_CODEX_COMMAND ?? 'codex')
        : undefined,
      {
        email: process.env.ZURI_REPORT_EMAIL || undefined,
        name: process.env.ZURI_REPORT_NAME || undefined,
        phone: process.env.ZURI_REPORT_PHONE || undefined,
      },
    );
    const webhook = await api.call('getWebhookInfo');
    if (webhook.url)
      throw new Error(
        'This bot already uses a webhook. Use a dedicated bot or remove its old webhook deliberately before starting.',
      );
    await api.call('getMe');
    const checkpoint = join(service.store.directory, 'telegram-offset.json');
    let offset = 0;
    try {
      offset = JSON.parse(await readFile(checkpoint, 'utf8')).offset;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Invalid Telegram checkpoint. Inspect it before continuing.');
    }
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error('Invalid Telegram checkpoint.');
    console.error(
      'Telegram bridge running for one allowed private user. No public listener. Press Ctrl+C to stop.',
    );
    while (!stopping) {
      let updates: any[];
      try {
        updates = await api.call('getUpdates', {
          offset,
          timeout: 25,
          limit: 20,
          allowed_updates: ['message', 'callback_query'],
        });
      } catch {
        console.error(
          'Telegram polling unavailable; retrying polling in 5 seconds. Outgoing actions are not replayed.',
        );
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const update of updates) {
        if (stopping) break;
        if (!Number.isSafeInteger(update.update_id) || update.update_id < offset) continue;
        offset = update.update_id + 1;
        // Record before handling: after a crash, old callbacks cannot silently trigger a send.
        await writeFile(`${checkpoint}.tmp`, JSON.stringify({ offset }), {
          mode: 0o600,
          flush: true,
        });
        await rename(`${checkpoint}.tmp`, checkpoint);
        try {
          await bot.handle(update);
        } catch {
          console.error(
            'A Telegram interaction failed. It will not be automatically replayed; check /status before resending.',
          );
        }
      }
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await client.close();
    await server.close();
  }
}
