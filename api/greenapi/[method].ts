import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Proxies the browser calls to GREEN-API so the instance token never reaches the client bundle.
 * The browser only ever sends a method name; the credential stays in the server environment.
 */

type Env = {
  GREEN_API_URL?: string;
  GREEN_API_INSTANCE?: string;
  GREEN_API_TOKEN?: string;
};

const methodNamePattern = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const safeMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const hopByHopHeaders = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "content-length"]);

const readRawBody = (request: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const writeError = (response: ServerResponse, status: number, message: string) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: message }));
};

const handler = async (request: IncomingMessage, response: ServerResponse, method: string | undefined) => {
  if (!safeMethods.has(request.method ?? "")) {
    response.setHeader("Allow", [...safeMethods].join(", "));
    return writeError(response, 405, "Method not allowed");
  }

  if (!method || !methodNamePattern.test(method)) {
    return writeError(response, 400, "Unknown GREEN-API method");
  }

  const env = process.env as Env;
  const baseUrl = env.GREEN_API_URL?.replace(/\/$/, "");
  const instance = env.GREEN_API_INSTANCE;
  const token = env.GREEN_API_TOKEN;
  if (!baseUrl || !instance || !token) {
    return writeError(response, 500, "GREEN-API is not configured on the server");
  }

  const target = `${baseUrl}/waInstance${instance}/${method}/${token}`;
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
    if (!hopByHopHeaders.has(key.toLowerCase()) && !key.toLowerCase().startsWith("content-security-policy")) {
      response.setHeader(key, value);
    }
  });

  const payload = Buffer.from(await upstream.arrayBuffer());
  response.end(payload);
  return undefined;
};

const readMethodFromPath = (url: string | undefined) => {
  const match = /\/api\/greenapi\/([^/?#]+)/.exec(url ?? "");
  const raw = match?.[1];
  return raw ? decodeURIComponent(raw) : undefined;
};

export default async (request: IncomingMessage, response: ServerResponse) => {
  const method = readMethodFromPath(request.url);
  try {
    await handler(request, response, method);
  } catch (error) {
    if (!response.headersSent) writeError(response, 500, error instanceof Error ? error.message : "Unexpected proxy error");
    else response.end();
  }
};

export const config = { api: { bodyParser: false } };