import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramBot } from '../dist/telegram-bot.js';
import { TelegramApi } from '../dist/telegram-api.js';
import { codexDraftArgs, parseDraftResult } from '../dist/telegram-draft.js';

const userId = 123456789;
const preparedDraft = { action: 'prepare', category: 'Abfall/Sammelstelle', description: 'Abfall liegt neben dem Behälter.', message: '' };
function fixture({ enabled = true, draft, now = Date.now, phoneRequired = false, defaults = {}, submissionState = 'accepted' } = {}) {
  const output = [], tools = [];
  let messageId = 10;
  const messenger = {
    call: async (method, body) => { output.push({ method, body }); return true; },
    download: async () => Buffer.from('photo bytes mocked at MCP boundary'),
    sendText: async (chat, text, buttons) => { const result = { message_id: ++messageId }; output.push({ chat, text, buttons, ...result }); return result; },
    sendPhoto: async (chat, data) => { output.push({ chat, photo: data }); },
  };
  const mcp = async (name, args = {}) => {
    tools.push({ name, args });
    const replies = {
      resolve_location: args.query ? { candidates: [{ latitude: 47.37, longitude: 8.53, label: 'Basteiplatz' }] } : {
        map_url: 'https://www.zueriwieneu.ch/around?lat=47.37&lon=8.53',
        categories: { 'Abfall/Sammelstelle': { photo_required: false, phone_required: phoneRequired, bodies: ['ERZ'], extra_fields: [] } } },
      list_categories: { categories: [{ service_code: 'Abfall/Sammelstelle' }] },
      inspect_photo: { id: 'photo-1' },
      prepare_report: { preview_id: 'preview-1', nearby_reports: { matches: [], coverage: 'Recent public reports only.' } },
      get_preview: { preview_id: 'preview-1', confirmation_token: 'secret-preview-token', submission_enabled: enabled,
        map_url: 'https://www.zueriwieneu.ch/around', official_form_url: 'https://www.zueriwieneu.ch/report/new' },
      submit_report: { state: submissionState, message: submissionState, ...(submissionState === 'accepted' ? { url: 'https://www.zueriwieneu.ch/report/1' } : {}) },
      list_my_reports: { receipts: [] },
    };
    return { content: [{ type: 'text', text: JSON.stringify(replies[name]) },
      ...(['inspect_photo', 'get_preview'].includes(name) ? [{ type: 'image', data: 'aW1hZ2U=', mimeType: 'image/jpeg' }] : [])] };
  };
  const bot = new TelegramBot(userId, messenger, mcp, draft, defaults, now);
  const msg = extra => ({ message: { message_id: 1, date: Math.floor(now() / 1000), chat: { type: 'private', id: userId }, from: { id: userId }, ...extra } });
  const send = text => bot.handle(msg({ text }));
  const click = (value, mid) => bot.handle({ callback_query: { id: 'callback', from: { id: userId }, data: value,
    message: { chat: { type: 'private', id: userId }, message_id: mid } } });
  async function ready() {
    await bot.handle(msg({ photo: [{ file_id: 'telegram-photo' }] }));
    await bot.handle(msg({ location: { latitude: 47.37, longitude: 8.53 } }));
    const location = output.findLast(o => o.buttons);
    await click(location.buttons[0][0].callback_data, location.message_id);
    await send('/email resident@example.org');
    await send('/describe Ein Abfallbehälter ist überfüllt.');
    await send('/category Abfall/Sammelstelle');
  }
  return { bot, output, tools, msg, send, click, ready };
}

test('Telegram silently rejects other users, group chats and spoofed callback senders', async () => {
  const f = fixture();
  await f.bot.handle({ message: { chat: { type: 'private', id: 9 }, from: { id: 9 }, text: '/start' } });
  await f.bot.handle({ message: { chat: { type: 'group', id: userId }, from: { id: userId }, text: '/start' } });
  await f.bot.handle({ callback_query: { from: { id: 9 }, data: 'send:anything', message: { chat: { type: 'private', id: userId } } } });
  assert.equal(f.tools.length, 0); assert.equal(f.output.length, 0);
});

test('Telegram requires explicit location confirmation and never submits from plain text', async () => {
  const f = fixture();
  await f.bot.handle(f.msg({ location: { latitude: 47.37, longitude: 8.53 } }));
  await f.send('/preview');
  assert.match(f.output.at(-1).text, /confirm the exact issue location/);
  await f.send('/confirm');
  await f.send('Yes, send it now please');
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 0);
});

test('Telegram preview shows photos and contact details; exact Send button is consumed once', async () => {
  const f = fixture(); await f.ready(); await f.send('/preview');
  assert.ok(f.output.some(o => o.photo));
  const preview = f.output.findLast(o => o.buttons);
  assert.match(preview.text, /resident@example.org/);
  assert.match(preview.text, /may publish/);
  assert.ok(!preview.text.includes('secret-preview-token'));
  const data = preview.buttons[0][0].callback_data;
  assert.ok(Buffer.byteLength(data) <= 64);
  await f.click(data, preview.message_id + 1);
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 0);
  await f.click(data, preview.message_id);
  await f.click(data, preview.message_id);
  const submissions = f.tools.filter(t => t.name === 'submit_report');
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].args.human_confirmed, true);
  assert.equal(submissions[0].args.confirmation_token, 'secret-preview-token');
});

test('Telegram changing details invalidates the previous approval button', async () => {
  const f = fixture(); await f.ready(); await f.send('/preview');
  const preview = f.output.findLast(o => o.buttons);
  await f.send('/describe Neue Beschreibung nach der Vorschau.');
  await f.click(preview.buttons[0][0].callback_data, preview.message_id);
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 0);
});

test('disabled submission produces only official form fallback', async () => {
  const f = fixture({ enabled: false }); await f.ready();
  const start = f.output.length;
  await f.send('/preview');
  assert.equal(f.output.slice(start).some(o => o.buttons), false);
  assert.equal(f.output.at(-1).text, 'https://www.zueriwieneu.ch/report/new');
});

test('AI photo flow needs no drafting/category/preview commands and keeps final approval', async () => {
  const requests = [];
  const f = fixture({ draft: async value => { requests.push(value); return preparedDraft; } });
  await f.bot.handle(f.msg({ photo: [{ file_id: 'photo' }], caption: 'A bin with rubbish beside it' }));
  assert.match(f.output.at(-1).text, /Suggested category/);
  await f.bot.handle(f.msg({ location: { latitude: 47.37, longitude: 8.53 } }));
  const location = f.output.findLast(o => o.buttons);
  await f.click(location.buttons[0][0].callback_data, location.message_id);
  assert.match(f.output.at(-1).text, /What email/);
  await f.send('resident@example.org');
  const preview = f.output.findLast(o => o.buttons);
  assert.match(preview.text, /REPORT PREVIEW/);
  assert.match(preview.text, /resident@example.org/);
  assert.ok(!preview.text.includes('Name:'));
  assert.ok(!preview.text.includes('Phone:'));
  assert.equal(requests.length, 1);
  assert.deepEqual(Object.keys(requests[0]).sort(), ['caption', 'categories', 'images']);
  assert.ok(!JSON.stringify(requests).includes('resident@example.org'));
  assert.equal(f.tools.filter(t => t.name === 'prepare_report').length, 1);
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 0);
  await f.click(preview.buttons[0][0].callback_data, preview.message_id);
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 1);
});

test('clarification accepts an ordinary reply with question context, without collecting contacts early', async () => {
  const requests = [];
  const question = 'Is water continuously leaking from the fountain?';
  const f = fixture({ draft: async value => { requests.push(value); return requests.length === 1
    ? { action: 'clarify', category: null, description: null, message: question } : preparedDraft; } });
  await f.bot.handle(f.msg({ photo: [{ file_id: 'photo' }] }));
  assert.equal(f.output.at(-1).text, question);
  assert.equal(f.tools.some(t => t.name === 'prepare_report' || t.name === 'resolve_location'), false);
  await f.send('Yes, it is.');
  assert.equal(requests[1].previous_question, question);
  assert.match(requests[1].caption, /Yes, it is\./);
  assert.match(f.output.at(-1).text, /Suggested category/);
});

test('redirects do not collect location or contacts or create a preview', async () => {
  const message = 'For immediate danger, call 112.';
  const f = fixture({ draft: async () => ({ action: 'redirect', category: null, description: null, message }) });
  await f.bot.handle(f.msg({ photo: [{ file_id: 'photo' }] }));
  assert.equal(f.output.at(-1).text, message);
  await f.send('/preview');
  assert.equal(f.output.at(-1).text, message);
  assert.equal(f.tools.some(t => ['prepare_report', 'submit_report', 'resolve_location'].includes(t.name)), false);
});

test('AI asks for a required phone only and reuses saved contacts without sending them to the model', async () => {
  const requests = [];
  const f = fixture({ phoneRequired: true, defaults: { email: 'saved@example.org' },
    draft: async value => { requests.push(value); return preparedDraft; } });
  await f.bot.handle(f.msg({ photo: [{ file_id: 'photo' }] }));
  await f.bot.handle(f.msg({ location: { latitude: 47.37, longitude: 8.53 } }));
  const location = f.output.findLast(o => o.buttons);
  await f.click(location.buttons[0][0].callback_data, location.message_id);
  assert.match(f.output.at(-1).text, /requires a contact phone/);
  assert.equal(f.tools.some(t => t.name === 'prepare_report'), false);
  await f.send('+41 44 123 45 67');
  assert.equal(requests.length, 1);
  assert.ok(!JSON.stringify(requests).includes('saved@example.org'));
  assert.ok(!JSON.stringify(requests).includes('+41'));
  const preview = f.output.findLast(o => o.buttons);
  assert.match(preview.text, /saved@example.org/);
  assert.match(preview.text, /\+41 44 123 45 67/);
});

for (const outcome of ['clarify', 'redirect', 'failure', 'invalid']) {
  test(`AI ${outcome} clears the previous draft and its approval button`, async () => {
    let next = preparedDraft;
    const f = fixture({ draft: async () => { if (next instanceof Error) throw next; return next; } });
    await f.ready(); await f.send('/preview');
    const preview = f.output.findLast(o => o.buttons);
    const before = f.tools.filter(t => t.name === 'prepare_report').length;
    next = outcome === 'failure' ? new Error('Model unavailable') : outcome === 'invalid'
      ? { ...preparedDraft, category: 'Invented category' }
      : { action: outcome, category: null, description: null, message: 'Please use the appropriate channel or clarify the issue.' };
    await f.send('Please reassess this observation.');
    await f.click(preview.buttons[0][0].callback_data, preview.message_id);
    await f.send('/preview');
    assert.equal(f.tools.filter(t => t.name === 'prepare_report').length, before);
    assert.equal(f.tools.some(t => t.name === 'submit_report'), false);
  });
}

test('draft result validation allows no category for non-reports and rejects contradictory outputs', () => {
  const categories = ['Abfall/Sammelstelle'];
  assert.equal(parseDraftResult(preparedDraft, categories).action, 'prepare');
  for (const action of ['clarify', 'redirect']) {
    const result = { action, category: null, description: null, message: 'Please clarify or use the official channel.' };
    assert.equal(parseDraftResult(result, []).action, action);
    assert.throws(() => parseDraftResult({ ...result, category: categories[0] }, categories));
    assert.throws(() => parseDraftResult({ ...result, description: preparedDraft.description }, categories));
    assert.throws(() => parseDraftResult({ ...result, message: ' ' }, categories));
  }
  assert.throws(() => parseDraftResult({ ...preparedDraft, category: 'Invented' }, categories), /unavailable/);
  assert.throws(() => parseDraftResult({ ...preparedDraft, description: null }, categories));
  assert.throws(() => parseDraftResult({ ...preparedDraft, legal_status: 'illegal' }, categories));
});

test('automatic drafting and previews stop after an uncertain submission', async () => {
  let drafts = 0;
  const f = fixture({ submissionState: 'unknown', draft: async () => { drafts++; return preparedDraft; } });
  await f.ready(); await f.send('/preview');
  const preview = f.output.findLast(o => o.buttons);
  await f.click(preview.buttons[0][0].callback_data, preview.message_id);
  const before = f.tools.filter(t => t.name === 'prepare_report').length, beforeDrafts = drafts;
  await f.send('Please try the report again.');
  await f.send('/email changed@example.org');
  await f.send('/preview');
  assert.match(f.output.at(-1).text, /already attempted/);
  assert.equal(drafts, beforeDrafts);
  assert.equal(f.tools.filter(t => t.name === 'prepare_report').length, before);
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 1);
});

test('old messages and expired preview buttons do not send reports', async () => {
  let now = Date.now(); const f = fixture({ now: () => now });
  await f.bot.handle(f.msg({ date: Math.floor(now / 1000) - 3600, text: '/start' }));
  assert.equal(f.output.length, 0);
  await f.ready(); await f.send('/preview');
  const preview = f.output.findLast(o => o.buttons);
  now += 3600001;
  await f.click(preview.buttons[0][0].callback_data, preview.message_id);
  assert.equal(f.tools.filter(t => t.name === 'submit_report').length, 0);
});

test('Telegram download is bounded and errors never disclose the bot token', async () => {
  const token = '123456:TEST_SECRET_TOKEN_123456789';
  const api = new TelegramApi(token, async url => { throw new Error(String(url)); });
  await assert.rejects(() => api.call('getMe'), error => !error.message.includes(token));
  let requests = 0;
  const oversized = new TelegramApi(token, async () => { requests++; return Response.json({ ok: true, result: { file_path: 'photos/a.jpg', file_size: 16 * 1024 * 1024 } }); });
  await assert.rejects(() => oversized.download('a'), /15 MiB/); assert.equal(requests, 1);
});

test('Codex photo drafting uses constrained execution and no shell interpolation', () => {
  const args = codexDraftArgs('/tmp/draft;literal', ['/tmp/image;literal.jpg']);
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('features.plugins=false'));
  assert.ok(args.includes('mcp_servers={}'));
  assert.ok(args.includes('/tmp/image;literal.jpg'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
});
