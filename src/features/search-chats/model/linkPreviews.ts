export type LinkPreview = {
  url: string;
  title: string;
  siteName: string;
  image: string | null;
};

const storageKey = "modern-chat-link-previews";
const cacheTtlMs = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = { preview: LinkPreview | null; at: number };

const readCache = (): Map<string, CacheEntry> => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    return new Map(Object.entries(parsed as Record<string, CacheEntry>));
  } catch {
    return new Map();
  }
};

const cache = readCache();
const inFlight = new Map<string, Promise<LinkPreview | null>>();

const remember = (url: string, preview: LinkPreview | null) => {
  cache.set(url, { preview, at: Date.now() });
  try {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(cache.entries())));
  } catch {
    return new Map();
  }
};

const cached = (url: string) => {
  const entry = cache.get(url);
  if (!entry) return undefined;
  if (Date.now() - entry.at > cacheTtlMs) {
    cache.delete(url);
    return undefined;
  }
  return entry.preview;
};

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const previewFor = (url: string): LinkPreview => ({
  url,
  title: url,
  siteName: hostOf(url),
  image: null,
});

export const loadLinkPreview = async (url: string): Promise<LinkPreview | null> => {
  const known = cached(url);
  if (known !== undefined) return known;
  const running = inFlight.get(url);
  if (running) return running;

  const request = fetch(`/api/og?url=${encodeURIComponent(url)}`)
    .then(async (response) => {
      if (response.status === 204) return null;
      if (!response.ok) return null;
      const data = await response.json() as Partial<LinkPreview>;
      if (!data.title) return null;
      return { url, title: data.title, siteName: data.siteName ?? hostOf(url), image: data.image ?? null } satisfies LinkPreview;
    })
    .catch(() => null)
    .then((preview) => {
      remember(url, preview);
      return preview;
    })
    .finally(() => inFlight.delete(url));

  inFlight.set(url, request);
  return request;
};