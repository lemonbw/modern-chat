import axios from "axios";

const minimumIntervalMs = 1_100;
const maxRateLimitRetries = 3;
const inFlightRequests = new Map<string, Promise<unknown>>();
const methodQueues = new Map<string, Promise<void>>();
const nextAllowedAt = new Map<string, number>();

const wait = (durationMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
const intervalForMethod = (method: string) => method === "getMessage" ? 150 : minimumIntervalMs;

const retryDelay = (error: unknown, attempt: number) => {
  if (axios.isAxiosError(error)) {
    const header = error.response?.headers["retry-after"];
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1_000;
    if (typeof header === "string") {
      const dateDelay = Date.parse(header) - Date.now();
      if (Number.isFinite(dateDelay) && dateDelay > 0) return dateDelay;
    }
  }
  return minimumIntervalMs * (attempt + 1);
};

const reserveRateLimitSlot = async (method: string) => {
  const interval = intervalForMethod(method);
  const storageKey = `green-api-next:${method}`;
  const storedNext = Number(window.localStorage.getItem(storageKey));
  const allowedAt = Math.max(nextAllowedAt.get(method) ?? 0, Number.isFinite(storedNext) ? storedNext : 0);
  const delay = allowedAt - Date.now();
  if (delay > 0) await wait(delay);
  const next = Date.now() + interval;
  nextAllowedAt.set(method, next);
  window.localStorage.setItem(storageKey, String(next));
};

const runWithMethodLimit = async <T>(method: string, request: () => Promise<T>): Promise<T> => {
  const previous = methodQueues.get(method) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  methodQueues.set(method, current);
  await previous;

  try {
    const run = async () => {
      for (let attempt = 0; ; attempt += 1) {
        await reserveRateLimitSlot(method);
        try {
          return await request();
        } catch (error) {
          if (!axios.isAxiosError(error) || error.response?.status !== 429 || attempt >= maxRateLimitRetries) throw error;
          const delay = retryDelay(error, attempt);
          const next = Date.now() + delay;
          nextAllowedAt.set(method, next);
          window.localStorage.setItem(`green-api-next:${method}`, String(next));
        }
      }
    };

    if (navigator.locks) {
      return await navigator.locks.request(`modern-chat-green-api:${method}`, run);
    }
    return await run();
  } finally {
    release();
    if (methodQueues.get(method) === current) methodQueues.delete(method);
  }
};

/** Deduplicates identical reads and spaces calls to each rate-limited GREEN-API method. */
export const greenApiRead = <T>(method: string, requestKey: string, request: () => Promise<T>): Promise<T> => {
  const key = `${method}:${requestKey}`;
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const pending = runWithMethodLimit(method, request).finally(() => {
    if (inFlightRequests.get(key) === pending) inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, pending);
  return pending;
};
