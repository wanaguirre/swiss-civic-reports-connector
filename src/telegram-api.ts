import { MAX_PHOTO_BYTES } from './photos.js';

export class TelegramApi {
  constructor(
    private token: string,
    private request: typeof fetch = fetch,
  ) {
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))
      throw new Error('Set a valid ZURI_TELEGRAM_BOT_TOKEN in your private environment.');
  }
  async call(method: string, body: Record<string, unknown> | FormData = {}): Promise<any> {
    if (!/^[A-Za-z]+$/.test(method)) throw new Error('Invalid Telegram method.');
    try {
      const response = await this.request(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(40_000),
        ...(body instanceof FormData
          ? { body }
          : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
      });
      if (!response.ok) throw new Error('HTTP failure');
      const result = await response.json();
      if (!result.ok) throw new Error('API failure');
      return result.result;
    } catch {
      throw new Error(`Telegram ${method} failed. No automatic replay of outgoing messages.`);
    }
  }
  async download(fileId: string) {
    const info = await this.call('getFile', { file_id: fileId });
    if (
      !info.file_path ||
      !/^[A-Za-z0-9_./-]+$/.test(info.file_path) ||
      info.file_path.includes('..') ||
      info.file_size > MAX_PHOTO_BYTES
    ) {
      throw new Error('Unsupported Telegram file or image larger than 15 MiB.');
    }
    try {
      const response = await this.request(
        `https://api.telegram.org/file/bot${this.token}/${info.file_path}`,
        { redirect: 'error', signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok || !response.body) throw new Error('Download failed');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_PHOTO_BYTES) throw new Error('File too large');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      return Buffer.concat(chunks);
    } catch {
      throw new Error('Telegram photo download failed or exceeds 15 MiB.');
    }
  }
  async sendText(
    chat: number,
    text: string,
    buttons?: { text: string; callback_data: string }[][],
  ) {
    return this.call('sendMessage', {
      chat_id: chat,
      text,
      link_preview_options: { is_disabled: true },
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }
  async sendPhoto(chat: number, base64: string) {
    const form = new FormData();
    form.set('chat_id', String(chat));
    form.set(
      'photo',
      new Blob([new Uint8Array(Buffer.from(base64, 'base64'))], { type: 'image/jpeg' }),
      'preview.jpg',
    );
    return this.call('sendPhoto', form);
  }
}
