import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Session state for the app itself. The GREEN-API credential stays on the server and is only
 * reachable through the proxy, which refuses every request without a valid session cookie.
 */

export const SESSION_COOKIE = "mc_session";
export const WRITE_COOKIE = "mc_write";

const SESSION_TTL_SECONDS = 24 * 60 * 60;
const WRITE_TTL_SECONDS = 60 * 60;

type Env = {
  APP_PASSWORD?: string;
  WRITE_PASSWORD?: string;
  SESSION_SECRET?: string;
  APP_ALLOW_WRITES?: string;
};

export type AppSession = { v: 1; iat: number; exp: number };

const env = () => process.env as Env;

export const appPassword = () => env().APP_PASSWORD?.trim() ?? "";

export const writePassword = () => env().WRITE_PASSWORD?.trim() || appPassword();

export const writesEnabled = () => (env().APP_ALLOW_WRITES ?? "true").toLowerCase() !== "false";

/** Without SESSION_SECRET the key is derived from the app password, so forging needs that password. */
export const sessionSecret = () => {
  const explicit = env().SESSION_SECRET?.trim();
  return explicit || createHash("sha256").update(`modern-chat:${appPassword()}`).digest("hex");
};

export const parseCookies = (header?: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    if (!name || !raw) continue;
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
};

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");

export const signToken = (payload: AppSession, secret: string) => {
  const body = encode(JSON.stringify(payload));
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
};

export const verifyToken = (token: string | undefined, secret: string): AppSession | null => {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: AppSession;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AppSession;
  } catch {
    return null;
  }
  if (payload?.v !== 1 || typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
  return payload;
};

export const checkPassword = (candidate: unknown, expected: string) => {
  if (typeof candidate !== "string" || !candidate || !expected) return false;
  return timingSafeEqual(createHash("sha256").update(candidate).digest(), createHash("sha256").update(expected).digest());
};

const nowInSeconds = () => Math.floor(Date.now() / 1000);

export const newSession = (): AppSession => {
  const issued = nowInSeconds();
  return { v: 1, iat: issued, exp: issued + SESSION_TTL_SECONDS };
};

export const newWriteGrant = (): AppSession => {
  const issued = nowInSeconds();
  return { v: 1, iat: issued, exp: issued + WRITE_TTL_SECONDS };
};

export const readSession = (request: IncomingMessage) => verifyToken(parseCookies(request.headers.cookie)[SESSION_COOKIE], sessionSecret());

export const hasWriteGrant = (request: IncomingMessage) => verifyToken(parseCookies(request.headers.cookie)[WRITE_COOKIE], sessionSecret()) !== null;

/** Cookies marked Secure are dropped by browsers over plain http, so localhost stays usable. */
const isSecureHost = (request: IncomingMessage) => {
  const forwarded = String(request.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  if (forwarded) return forwarded === "https";
  return !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(String(request.headers.host ?? ""));
};

const serialize = (name: string, value: string, maxAge: number, request: IncomingMessage) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecureHost(request) ? "; Secure" : ""}`;

export const sessionCookie = (request: IncomingMessage) => serialize(SESSION_COOKIE, signToken(newSession(), sessionSecret()), SESSION_TTL_SECONDS, request);

export const writeCookie = (request: IncomingMessage) => serialize(WRITE_COOKIE, signToken(newWriteGrant(), sessionSecret()), WRITE_TTL_SECONDS, request);

export const clearedCookies = (request: IncomingMessage) => [serialize(SESSION_COOKIE, "", 0, request), serialize(WRITE_COOKIE, "", 0, request)];