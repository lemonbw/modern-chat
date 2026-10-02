import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCookies, SESSION_COOKIE, sessionCookie } from "./_session.ts";

const lookupMock = vi.fn();

vi.mock("node:dns/promises", () => ({ default: { lookup: (...args: unknown[]) => lookupMock(...args) }, lookup: (...args: unknown[]) => lookupMock(...args) }));

const ogPreview = (await import("./og.ts")).default;

const sessionCookieValue = () => {
  process.env.APP_PASSWORD = "open-sesame";
  process.env.SESSION_SECRET = "test-secret";
  const header = sessionCookie({ headers: { host: "localhost:5173" } } as IncomingMessage);
  return `${SESSION_COOKIE}=${parseCookies(header.split(";")[0])[SESSION_COOKIE]}`;
};

type StubResponse = ServerResponse & { statusCode: number; body: string };

const createResponse = () => {
  const chunks: Buffer[] = [];
  const response = {
    statusCode: 0,
    headersSent: false,
    setHeader: vi.fn(),
    end: (chunk?: Buffer | string) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      response.headersSent = true;
      return response;
    },
    body: () => Buffer.concat(chunks).toString(),
  };
  return response as unknown as StubResponse & { body: () => string };
};

const html = (title: string) => `<html><head><meta property="og:title" content="${title}" /></head><body></body></html>`;

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("open graph preview", () => {
  it("returns the title of a public page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html("A public page"), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })));
    const response = createResponse();
    await ogPreview({ method: "GET", url: "/api/og?url=https://example.com/article", headers: { host: "localhost:5173", cookie: sessionCookieValue() } } as IncomingMessage, response as ServerResponse);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body()).title).toBe("A public page");
  });

  it("refuses a host that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = createResponse();
    await ogPreview({ method: "GET", url: "/api/og?url=http://intranet.local/", headers: { host: "localhost:5173", cookie: sessionCookieValue() } } as IncomingMessage, response as ServerResponse);
    expect(response.statusCode).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks every redirect hop, so a redirect cannot reach the metadata service", async () => {
    // A literal address resolves to itself, which is how the metadata service is reached.
    lookupMock.mockImplementation(async (hostname: string) => [{ address: hostname === "example.com" ? "93.184.216.34" : hostname, family: 4 }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response("", {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data/" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = createResponse();
    await ogPreview({ method: "GET", url: "/api/og?url=https://example.com/start", headers: { host: "localhost:5173", cookie: sessionCookieValue() } } as IncomingMessage, response as ServerResponse);
    expect(response.statusCode).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a protocol it cannot read", async () => {
    const response = createResponse();
    await ogPreview({ method: "GET", url: "/api/og?url=file:///etc/passwd", headers: { host: "localhost:5173", cookie: sessionCookieValue() } } as IncomingMessage, response as ServerResponse);
    expect(response.statusCode).toBe(400);
  });

  it("refuses a missing url", async () => {
    const response = createResponse();
    await ogPreview({ method: "GET", url: "/api/og", headers: { host: "localhost:5173", cookie: sessionCookieValue() } } as IncomingMessage, response as ServerResponse);
    expect(response.statusCode).toBe(400);
  });

  it("refuses a preview without a session, so the server is not an open fetcher", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = createResponse();
    await ogPreview({ method: "GET", url: "/api/og?url=https://example.com/article", headers: { host: "localhost:5173" } } as IncomingMessage, response as ServerResponse);
    expect(response.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});