import type { IncomingMessage, ServerResponse } from "node:http";
import {
  appPassword,
  checkPassword,
  clearedCookies,
  hasWriteGrant,
  readSession,
  sessionCookie,
  writeCookie,
  writePassword,
  writesEnabled,
} from "./_session.ts";

/**
 * The app gate: a password the operator sets in the environment. A browser holds nothing but an
 * HttpOnly cookie, and the GREEN-API credential is reachable only through a request that carries it.
 */

const MAX_BODY_BYTES = 4 * 1024;
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

/** Best effort per instance: a serverless function keeps this map only while it stays warm. */
const failures = new Map<string, { count: number; until: number; at: number }>();

const lockRemaining = (key: string) => {
  const entry = failures.get(key);
  if (!entry) return 0;
  return entry.until > Date.now() ? entry.until - Date.now() : 0;
};

const registerFailure = (key: string) => {
  const count = (failures.get(key)?.count ?? 0) + 1;
  failures.set(key, { count, until: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0, at: Date.now() });
  if (failures.size > 5_000) {
    const stale = Date.now() - 60 * 60 * 1000;
    for (const [candidate, value] of failures) if (value.until <= Date.now() && value.at < stale) failures.delete(candidate);
  }
};

export const resetLoginFailures = () => failures.clear();

const readJsonBody = (request: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as unknown;
        resolve(parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {});
      } catch {
        reject(Object.assign(new Error("Body must be valid JSON"), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });

/** Node appends repeated headers, but the function stub used in tests may not know `appendHeader`. */
const appendCookie = (response: ServerResponse, cookie: string) => {
  const target = response as ServerResponse & { appendHeader?: (name: string, value: string) => void };
  if (typeof target.appendHeader === "function") target.appendHeader("Set-Cookie", cookie);
  else target.setHeader("Set-Cookie", cookie);
};

const writeJson = (response: ServerResponse, status: number, payload: Record<string, unknown>, cookies: string[] = []) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  for (const cookie of cookies) appendCookie(response, cookie);
  response.end(JSON.stringify(payload));
};

const isSameOrigin = (request: IncomingMessage) => {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
};

const clientKey = (request: IncomingMessage) => String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || String(request.socket?.remoteAddress ?? "local");

const handler = async (request: IncomingMessage, response: ServerResponse) => {
  if (!isSameOrigin(request)) return writeJson(response, 403, { error: "Cross origin requests are not allowed" });
  if (!appPassword()) return writeJson(response, 500, { error: "APP_PASSWORD is not set on the server" });

  if (request.method === "GET") {
    const authenticated = readSession(request) !== null;
    return writeJson(response, 200, { authenticated, writesEnabled: writesEnabled(), writeGranted: authenticated && hasWriteGrant(request) });
  }

  if (request.method === "DELETE") {
    return writeJson(response, 200, { ok: true, authenticated: false, writesEnabled: writesEnabled(), writeGranted: false }, clearedCookies(request));
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST, DELETE");
    return writeJson(response, 405, { error: "Method not allowed" });
  }

  const key = clientKey(request);
  const remaining = lockRemaining(key);
  if (remaining > 0) return writeJson(response, 429, { error: `Too many attempts. Try again in ${Math.ceil(remaining / 1000)} seconds.` });

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : 400;
    return writeJson(response, statusCode === 413 ? 413 : 400, { error: error instanceof Error ? error.message : "Invalid body" });
  }

  const password = body.password;

  if (body.scope === "write") {
    if (!readSession(request)) return writeJson(response, 401, { error: "Sign in required" });
    if (!writesEnabled()) return writeJson(response, 403, { error: "This deployment is read only" });
    if (!checkPassword(password, writePassword())) {
      registerFailure(key);
      return writeJson(response, 401, { error: "Wrong write password" });
    }
    failures.delete(key);
    return writeJson(response, 200, { ok: true, writeGranted: true }, [writeCookie(request)]);
  }

  if (!checkPassword(password, appPassword())) {
    registerFailure(key);
    return writeJson(response, 401, { error: "Wrong password" });
  }
  failures.delete(key);

  const cookies = [sessionCookie(request)];
  const writeGranted = writesEnabled() && writePassword() === appPassword();
  if (writeGranted) cookies.push(writeCookie(request));
  return writeJson(response, 200, { ok: true, authenticated: true, writesEnabled: writesEnabled(), writeGranted }, cookies);
};

export const authHandler = handler;

export default async (request: IncomingMessage, response: ServerResponse) => {
  try {
    await handler(request, response);
  } catch (error) {
    if (!response.headersSent) writeJson(response, 500, { error: error instanceof Error ? error.message : "Unexpected auth error" });
    else response.end();
  }
};

export const config = { api: { bodyParser: false } };