/**
 * GREEN-API counts every call per method and answers 466 when the monthly quota of that method is
 * gone. Remembering the pause in localStorage keeps a reload from spending the last calls again,
 * and the timeout lets a method recover by itself when the quota resets.
 */
const storageKey = "green-api-quota-paused";
const pauseTtlMs = 6 * 60 * 60 * 1000;

type PausedMethods = Record<string, number>;

const read = (): PausedMethods => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PausedMethods;
  } catch {
    return {};
  }
};

const write = (paused: PausedMethods) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(paused));
  } catch {
    // Without storage the pause lasts for the current session only.
  }
};

export const quotaErrorStatus = 466;

export const isMethodPaused = (method: string) => {
  const paused = read();
  const until = paused[method];
  if (!until) return false;
  if (until <= Date.now()) {
    delete paused[method];
    write(paused);
    return false;
  }
  return true;
};

export const pauseMethod = (method: string) => {
  const paused = read();
  paused[method] = Date.now() + pauseTtlMs;
  write(paused);
};