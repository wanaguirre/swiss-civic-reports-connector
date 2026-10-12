import { TelegramApi } from '../dist/telegram-api.js';
const api = new TelegramApi(process.env.ZURI_TELEGRAM_BOT_TOKEN ?? '');
const me = await api.call('getMe');
if ((await api.call('getWebhookInfo')).url) throw new Error('Bot already has a webhook. Use a new dedicated bot.');
console.log(`Open https://t.me/${me.username}, send /start, then return here. Waiting up to 25 seconds…`);
const updates = await api.call('getUpdates', { timeout: 25, limit: 100, allowed_updates: ['message'] });
const users = new Map();
for (const update of updates) {
  const m = update.message;
  if (m?.chat?.type === 'private' && m.from?.id === m.chat.id && !m.from.is_bot) users.set(m.from.id, m.from.username ?? m.from.first_name ?? '(no name)');
}
if (!users.size) console.log('No private messages found. Send /start to the bot and run this command again.');
for (const [id, label] of users) console.log(`Sender ${label}: ZURI_TELEGRAM_USER_ID=${id} — select only your own account.`);
