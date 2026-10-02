import type { IncomingMessage, ServerResponse } from "node:http";
import { hasWriteGrant, readSession, writesEnabled } from "../_session.ts";

/**
 * Proxies the browser calls to GREEN-API so the instance token never reaches the client bundle.
 * The browser only ever sends a method name; the credential stays in the server environment.
 * Every call needs a valid app session, and only the read methods run without the write grant.
 */

type Env = {
  GREEN_API_URL?: string;
  GREEN_API_INSTANCE?: string;
  GREEN_API_TOKEN?: string;
};

/** Everything that only reads. Anything not listed here can change state and needs the write grant. */
export const readOnlyMethods = new Set([
  "qr",
  "getStateInstance",
  "getAccountSettings",
  "checkAccount",
  "startAuthorization",
  "sendAuthorizationCode",
  "sendAuthorizationPassword",
  "getChats",
  "getContacts",
  "getContactInfo",
  "getGroupData",
  "getAvatar",
  "getChatHistory",
  "getMessage",
]);

const methodNamePattern = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const safeMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const hopByHopHeaders = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "content-length"]);
/** Headers that would either widen access to the response or hand out upstream state. */
const strippedHeaders = new Set(["set-cookie", "set-cookie2", "access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-methods", "access-control-allow-headers", "access-control-expose-headers"]);
/** The browser only sends small JSON. */
const maxBodyBytes = 1024 * 1024;
const maxResponseBytes = 8 * 1024 * 1024;

const readRawBody = (request: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const readLimited = async (upstream: Response) => {
  const declared = Number(upstream.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxResponseBytes) {
    throw Object.assign(new Error("Upstream response is too large"), { statusCode: 502 });
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length > maxResponseBytes) {
    throw Object.assign(new Error("Upstream response is too large"), { statusCode: 502 });
  }
  return buffer;
};

/** A browser request has to come from this origin; other clients send no Origin at all. */
const isSameOrigin = (request: IncomingMessage) => {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
};

const writeError = (response: ServerResponse, status: number, message: string, code?: string) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (status === 401) response.setHeader("WWW-Authenticate", 'Session realm="modern-chat", charset="UTF-8"');
  response.end(JSON.stringify({ error: message, ...(code ? { code } : {}) }));
};

const handler = async (request: IncomingMessage, response: ServerResponse, method: string | undefined, search: string) => {
  if (!safeMethods.has(request.method ?? "")) {
    response.setHeader("Allow", [...safeMethods].join(", "));
    return writeError(response, 405, "Method not allowed");
  }

  if (!method || !methodNamePattern.test(method)) {
    return writeError(response, 400, "Unknown GREEN-API method");
  }

  if (!isSameOrigin(request)) {
    return writeError(response, 403, "Cross origin requests are not allowed");
  }

  // The header tells the client this was the app gate answering, not GREEN-API refusing a token.
  if (!readSession(request)) {
    return writeError(response, 401, "Sign in to use this app", "session_required");
  }

  if (!readOnlyMethods.has(method)) {
    if (!writesEnabled()) return writeError(response, 403, "This deployment is read only", "writes_disabled");
    if (!hasWriteGrant(request)) return writeError(response, 403, "This action needs the write password", "write_grant_required");
  }

  const env = process.env as Env;
  const baseUrl = env.GREEN_API_URL?.replace(/\/$/, "");
  const instance = env.GREEN_API_INSTANCE;
  const token = env.GREEN_API_TOKEN;
  if (!baseUrl || !instance || !token) {
    return writeError(response, 500, "GREEN-API is not configured on the server");
  }

  const target = `${baseUrl}/waInstance${instance}/${method}/${token}${search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await readRawBody(request) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: {
        ...(request.headers["content-type"] ? { "Content-Type": String(request.headers["content-type"]) } : {}),
        accept: request.headers.accept ? String(request.headers.accept) : "application/json",
      },
      body: body && body.length > 0 ? body : undefined,
      redirect: "manual",
    });
  } catch (error) {
    return writeError(response, 502, error instanceof Error ? error.message : "GREEN-API is unreachable");
  }

  response.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (!hopByHopHeaders.has(name) && !strippedHeaders.has(name) && !name.startsWith("content-security-policy")) {
      response.setHeader(key, value);
    }
  });

  const payload = await readLimited(upstream);
  response.end(payload);
  return undefined;
};

const parseRequestUrl = (url: string | undefined) => {
  const path = url ?? "";
  const search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  const raw = /\/api\/greenapi\/([^/?#]+)/.exec(path)?.[1];
  return { method: raw ? decodeURIComponent(raw) : undefined, search };
};

/** Exported for tests, the serverless entry point only needs the request and the response. */
export const proxyHandler = handler;

export default async (request: IncomingMessage, response: ServerResponse) => {
  const { method, search } = parseRequestUrl(request.url);
  try {
    await handler(request, response, method, search);
  } catch (error) {
    if (!response.headersSent) {
      const status = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : 500;
      writeError(response, status === 413 || status === 502 ? status : 500, error instanceof Error ? error.message : "Unexpected proxy error");
    } else response.end();
  }
};

export const config = { api: { bodyParser: false } };