/** Safe public metadata only; never cache HTML, cookies or submission payloads. */
export class MunicipalServiceUnavailable extends Error {
  readonly status = 503;
  constructor(readonly retryAfterSeconds: number) {
    super('The municipal service is temporarily busy. Please try again later.');
    this.name = 'MunicipalServiceUnavailable';
  }
}

type Cached = { expires: number; value: unknown };
type Pending = {
  origin: string;
  deadline: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

/** One budget per server process/transport, shared by all Anthrazit tenants.
 * These are conservative client limits, not verified provider quotas. */
export class AnthrazitTraffic {
  private active = 0;
  private tokens = 8;
  private updated: number;
  private queue: Pending[] = [];
  private waking = false;
  private cooldowns = new Map<string, { until: number; strikes: number }>();
  private cache = new Map<string, Cached>();
  private pending = new Map<string, Promise<unknown>>();
  private now: () => number;
  private wait: (ms: number) => Promise<void>;
  constructor(clock: { now?: () => number; wait?: (ms: number) => Promise<void> } = {}) {
    this.now = clock.now ?? Date.now;
    this.wait = clock.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.updated = this.now();
  }
  private unavailable(origin: string) {
    const until = this.cooldowns.get(origin)?.until ?? 0;
    return until > this.now()
      ? new MunicipalServiceUnavailable(Math.ceil((until - this.now()) / 1000))
      : undefined;
  }
  pause(origin: string, retryAfter: string | null, status = 429) {
    const now = this.now(),
      previous = this.cooldowns.get(origin);
    const strikes = Math.min(
      (previous && now < previous.until + 3_600_000 ? previous.strikes : 0) + 1,
      5,
    );
    const seconds = retryAfter && /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter) : NaN;
    const date = retryAfter && /^[A-Za-z]/.test(retryAfter) ? Date.parse(retryAfter) : NaN;
    const fallback = (status === 429 ? 300_000 : 60_000) * 2 ** (strikes - 1);
    // Honor a valid Retry-After; missing/invalid headers use conservative backoff.
    const delay = Math.min(
      Number.MAX_SAFE_INTEGER - now,
      Math.max(
        1000,
        Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - now : fallback,
      ),
    );
    this.cooldowns.set(origin, { until: Math.max(previous?.until ?? 0, now + delay), strikes });
    this.drain();
    return this.unavailable(origin)!;
  }
  async run<T>(origin: string, operation: () => Promise<T>): Promise<T> {
    const blocked = this.unavailable(origin);
    if (blocked) throw blocked;
    if (this.queue.length >= 32) throw new MunicipalServiceUnavailable(5);
    await new Promise<void>((resolve, reject) => {
      this.queue.push({ origin, deadline: this.now() + 5000, resolve, reject });
      this.drain();
    });
    try {
      // Another in-flight request can have received a rate limit since admission.
      const blocked = this.unavailable(origin);
      if (blocked) throw blocked;
      return await operation();
    } finally {
      this.active--;
      this.drain();
    }
  }
  private drain() {
    const now = this.now();
    this.tokens = Math.min(8, this.tokens + Math.max(0, now - this.updated) / 500);
    this.updated = now;
    this.queue = this.queue.filter((item) => {
      const error =
        this.unavailable(item.origin) ??
        (item.deadline <= now ? new MunicipalServiceUnavailable(5) : undefined);
      if (error) item.reject(error);
      return !error;
    });
    while (this.queue.length && this.active < 2 && this.tokens >= 1) {
      this.tokens--;
      this.active++;
      this.queue.shift()!.resolve();
    }
    if (this.queue.length && !this.waking) {
      this.waking = true;
      const timeout = Math.max(
        1,
        Math.min(this.queue[0].deadline - now, this.active < 2 ? (1 - this.tokens) * 500 : 500),
      );
      void this.wait(timeout).then(() => {
        this.waking = false;
        this.drain();
      });
    }
  }
  async read<T>(key: string, ttl: number, operation: () => Promise<T>): Promise<T> {
    for (const [key, entry] of this.cache) if (entry.expires <= this.now()) this.cache.delete(key);
    const cached = this.cache.get(key);
    if (cached) return structuredClone(cached.value) as T;
    let result = this.pending.get(key) as Promise<T> | undefined;
    if (!result) {
      if (this.pending.size >= 64) throw new MunicipalServiceUnavailable(5);
      result = Promise.resolve()
        .then(operation)
        .then((value) => {
          if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value!);
          this.cache.set(key, { expires: this.now() + ttl, value: structuredClone(value) });
          return value;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, result);
    }
    return structuredClone(await result);
  }
}

const transports = new WeakMap<typeof fetch, AnthrazitTraffic>();
export function anthrazitTraffic(request: typeof fetch) {
  let traffic = transports.get(request);
  if (!traffic) {
    traffic = new AnthrazitTraffic();
    transports.set(request, traffic);
  }
  return traffic;
}
