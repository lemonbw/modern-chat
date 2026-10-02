import { lookup } from "node:dns/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Reads the OpenGraph tags of a page so the links tab can show a title, a site name and a picture.
 * The browser cannot do this itself: most sites answer a cross origin request with a CORS error.
 */

type Preview = { url: string; title: string; siteName: string; image: string | null };
type CacheEntry = { preview: Preview | null; at: number };

const cacheTtlMs = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const maxDocumentBytes = 512 * 1024;
const requestTimeoutMs = 6000;

const maxRedirects = 3;
const maxCacheEntries = 500;

/** Loopback, link local, private, carrier grade, multicast and reserved ranges, in IPv4 and IPv6. */
const isBlockedAddress = (rawAddress: string) => {
  const address = rawAddress.replace(/^\[|\]$/g, "").toLowerCase();
  if (address === "::1" || address === "::" || address === "localhost") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb") || address.startsWith("ff")) return true;
  // IPv4 mapped IPv6, e.g. ::ffff:127.0.0.1
  const mapped = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(mapped)) return false;
  const octets = mapped.split(".").map(Number);
  if (octets.some((octet) => octet > 255)) return true;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
};

const blockedHost = /^(localhost$|.*\.localhost$|.*\.local$|.*\.internal$|0x)/i;

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=3600");
  response.end(JSON.stringify(body));
};

const metaContent = (html: string, property: string) => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const found = pattern.exec(html)?.[1];
    if (found) return decodeEntities(found).slice(0, 300);
  }
  return "";
};

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

const readLimited = async (target: Response) => {
  const reader = target.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxDocumentBytes) break;
    chunks.push(value);
  }
  reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks));
};

const concat = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const absoluteUrl = (value: string, base: string) => {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
};

const isPublicAddress = async (hostname: string) => {
  if (blockedHost.test(hostname)) return false;
  try {
    const records = await lookup(hostname, { all: true });
    return records.length > 0 && records.every((record) => !isBlockedAddress(`${record.address}`));
  } catch {
    // A host that does not resolve cannot be reached either.
    return false;
  }
};

const fetchDocument = async (start: URL, signal: AbortSignal) => {
  let target = start;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!(await isPublicAddress(target.hostname))) return null;
    const response = await fetch(target, {
      redirect: "manual",
      signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "ModernChat/1.0 (+link preview)" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      response.body?.cancel().catch(() => undefined);
      if (!location || hop === maxRedirects) return null;
      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        return null;
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") return null;
      target = next;
      continue;
    }
    return response;
  }
  return null;
};

const fetchPreview = async (target: URL): Promise<Preview | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetchDocument(target, controller.signal);
    if (!response) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    const html = await readLimited(response);
    const title = metaContent(html, "og:title") || metaContent(html, "twitter:title") || /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || "";
    if (!title) return null;
    return {
      url: target.toString(),
      title: decodeEntities(title),
      siteName: metaContent(html, "og:site_name") || target.hostname.replace(/^www\./, ""),
      image: absoluteUrl(metaContent(html, "og:image") || metaContent(html, "twitter:image"), response.url),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export default async (request: IncomingMessage, response: ServerResponse) => {
  if (request.method !== "GET") return json(response, 405, { error: "Method not allowed" });

  const raw = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).searchParams.get("url");
  if (!raw || raw.length > 2048) return json(response, 400, { error: "Missing url" });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json(response, 400, { error: "Invalid url" });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return json(response, 400, { error: "Unsupported protocol" });

  const cached = cache.get(target.toString());
  if (cached && Date.now() - cached.at < cacheTtlMs) return json(response, 200, cached.preview ?? {});

  const preview = await fetchPreview(target);
  // The cache lives in memory, so it needs a ceiling: unique urls must not grow it without end.
  if (cache.size >= maxCacheEntries) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(target.toString(), { preview, at: Date.now() });
  if (!preview) return json(response, 204, {});
  return json(response, 200, preview);
};