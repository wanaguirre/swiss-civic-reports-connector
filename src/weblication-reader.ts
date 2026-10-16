// Internal Weblication transport. Only ordinary GETs can run here; upload/form
// requests returned by adapters are local plans, never dispatched.
export class WeblicationReader<F extends { uploadUrl: string }> {
  private retryAt = 0;
  private active = 0;
  constructor(
    private request: typeof fetch,
    private now: () => number,
    private label: string,
    private domain: string,
    private formUrl: string,
    private inspectForm: (html: string) => F,
    private inspectUploader: (html: string, form: F) => { csrf: string; dir: string },
    private changed: () => Error,
    private requireSessionCookie = true,
  ) {}
  async session() {
    if (this.now() < this.retryAt)
      throw new Error(`${this.label} reads are paused. Try preparing later.`);
    if (this.active >= 2)
      throw new Error(`${this.label} has enough requests in progress. Try preparing later.`);
    this.active++;
    const cookies = new Map<string, string>();
    const read = async (url: string, limit: number) => {
      const response = await this.request(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: 'text/html',
          'User-Agent': `Civic ${this.label} preparation (read-only)`,
          ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        },
      });
      if (!response.ok || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
        const retry = response.headers.get('retry-after') ?? '';
        const delay = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - this.now();
        if (Number.isFinite(delay) && delay > 0)
          this.retryAt = this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now());
        await response.body?.cancel();
        throw this.changed();
      }
      try {
        for (const cookie of response.headers.getSetCookie()) {
          if (cookie.length > 4096 || cookies.size >= 8) throw this.changed();
          const [pair, ...attributes] = cookie.split(';'),
            split = pair.indexOf('=');
          const name = pair.slice(0, split),
            value = pair.slice(split + 1);
          if (
            split < 1 ||
            !/^[a-zA-Z0-9_%.-]+$/.test(name) ||
            !/^[\x21-\x3A\x3C-\x7E]+$/.test(value)
          )
            throw this.changed();
          for (const item of attributes) {
            const [k, v] = item.trim().split('=');
            if (
              k.toLowerCase() === 'domain' &&
              ![this.domain, '.' + this.domain, 'www.' + this.domain].includes(v?.toLowerCase())
            )
              throw this.changed();
            if (k.toLowerCase() === 'path' && v !== '/') throw this.changed();
            if (k.toLowerCase() === 'max-age' && Number(v) <= 0) throw this.changed();
            if (k.toLowerCase() === 'expires' && Date.parse(v) <= this.now()) throw this.changed();
          }
          cookies.set(name, value);
        }
      } catch {
        await response.body?.cancel().catch(() => {});
        throw this.changed();
      }
      if (!response.body) throw this.changed();
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > limit) throw this.changed();
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return Buffer.concat(chunks).toString('utf8');
    };
    try {
      const form = this.inspectForm(await read(this.formUrl, 1_000_000));
      if (
        (this.requireSessionCookie && !cookies.has('WSESSIONID')) ||
        ('sessionId' in form &&
          cookies.has('WSESSIONID') &&
          form.sessionId !== cookies.get('WSESSIONID'))
      )
        throw this.changed();
      const widget = this.inspectUploader(await read(form.uploadUrl, 200_000), form);
      return { ...form, ...widget, cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    } catch {
      this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
      throw this.changed();
    } finally {
      this.active--;
    }
  }
}
