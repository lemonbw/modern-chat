import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyHandler } from "./[method].ts";

type StubRequest = IncomingMessage & PassThrough & { method: string; url: string };

const createRequest = (url: string, method = "GET", body = "", headers: Record<string, string> = {}): StubRequest => {
  const stream = new PassThrough() as unknown as StubRequest;
  stream.method = method;
  stream.url = url;
  stream.headers = { accept: "application/json", host: "localhost:5173", ...headers } as unknown as IncomingMessage["headers"];
  if (body) {
    stream.headers["content-type"] = "application/json";
    process.nextTick(() => {
      stream.write(body);
      stream.end();
    });
  } else {
    process.nextTick(() => stream.end());
  }
  return stream;
};

type StubResponse = ServerResponse & { statusCode: number; body: string };

const createResponse = () => {
  const chunks: Buffer[] = [];
  const response = {
    statusCode: 0,
    headersSent: false,
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    end: (chunk?: Buffer | string) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      response.headersSent = true;
      return response;
    },
    body: () => Buffer.concat(chunks).toString(),
  };
  return response as unknown as StubResponse & { body: () => string; setHeader: ReturnType<typeof vi.fn> };
};

const upstreamMock = vi.fn();

beforeEach(() => {
  process.env.GREEN_API_URL = "https://api.green-api.com";
  process.env.GREEN_API_INSTANCE = "1100000000";
  process.env.GREEN_API_TOKEN = "secret-token";
  upstreamMock.mockReset();
  upstreamMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", upstreamMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("green api proxy", () => {
  it("adds the instance and the token on the server side", async () => {
    await proxyHandler(createRequest("/api/greenapi/getChats"), createResponse() as ServerResponse, "getChats", "");
    expect(upstreamMock).toHaveBeenCalledWith(
      "https://api.green-api.com/waInstance1100000000/getChats/secret-token",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("keeps the query string of the browser call", async () => {
    await proxyHandler(createRequest("/api/greenapi/qr?_ts=42"), createResponse() as ServerResponse, "qr", "?_ts=42");
    expect(upstreamMock.mock.calls[0]?.[0]).toContain("_ts=42");
  });

  it("forwards the body of a post", async () => {
    await proxyHandler(createRequest("/api/greenapi/sendMessage", "POST", JSON.stringify({ chatId: "1" })), createResponse() as ServerResponse, "sendMessage", "");
    const [, init] = upstreamMock.mock.calls[0] as [string, RequestInit];
    expect(Buffer.from(init.body as Buffer).toString()).toContain('"chatId":"1"');
  });

  it("returns the status of green api unchanged", async () => {
    upstreamMock.mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 466 }));
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/getAvatar"), response as ServerResponse, "getAvatar", "");
    expect(response.statusCode).toBe(466);
  });

  it("rejects a method name that is not a plain identifier", async () => {
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/..%2F..%2Fetc%2Fpasswd"), response as ServerResponse, "..%2F..%2Fetc%2Fpasswd", "");
    expect(response.statusCode).toBe(400);
    expect(upstreamMock).not.toHaveBeenCalled();
  });

  it("rejects a missing method", async () => {
    const response = createResponse();
    await proxyHandler(createRequest("/api/other/getChats"), response as ServerResponse, undefined, "");
    expect(response.statusCode).toBe(400);
  });

  it("refuses to work without a server token", async () => {
    delete process.env.GREEN_API_TOKEN;
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/getChats"), response as ServerResponse, "getChats", "");
    expect(response.statusCode).toBe(500);
    expect(response.body()).not.toContain("secret-token");
    expect(upstreamMock).not.toHaveBeenCalled();
  });

  it("refuses a cross origin browser call", async () => {
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/getChats", "GET", "", { origin: "https://evil.example" }), response as ServerResponse, "getChats", "");
    expect(response.statusCode).toBe(403);
    expect(upstreamMock).not.toHaveBeenCalled();
  });

  it("allows a browser call from this origin", async () => {
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/getChats", "GET", "", { origin: "http://localhost:5173" }), response as ServerResponse, "getChats", "");
    expect(response.statusCode).toBe(200);
  });

  it("does not forward the cors headers of the upstream", async () => {
    upstreamMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Set-Cookie": "session=1" },
    }));
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/getChats"), response as ServerResponse, "getChats", "");
    const forwarded = response.setHeader.mock.calls.map((call: unknown[]) => String(call[0]).toLowerCase());
    expect(forwarded).not.toContain("access-control-allow-origin");
    expect(forwarded).not.toContain("set-cookie");
  });

  it("rejects a body larger than one megabyte", async () => {
    const response = createResponse();
    await expect(proxyHandler(createRequest("/api/greenapi/sendMessage", "POST", "x".repeat(1024 * 1024 + 64)), response as ServerResponse, "sendMessage", ""))
      .rejects.toThrow();
    expect(upstreamMock).not.toHaveBeenCalled();
  });

  it("blocks an http method that is not allowed", async () => {
    const response = createResponse();
    await proxyHandler(createRequest("/api/greenapi/getChats", "TRACE"), response as ServerResponse, "getChats", "");
    expect(response.statusCode).toBe(405);
  });
});