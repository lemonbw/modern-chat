import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasWriteGrant, parseCookies, readSession, SESSION_COOKIE, sessionCookie, WRITE_COOKIE } from "./_session.ts";
import authEndpoint, { resetLoginFailures } from "./auth.ts";

type StubRequest = IncomingMessage & PassThrough & { method: string; url: string };

const createRequest = (method: string, body = "", cookie?: string): StubRequest => {
  const stream = new PassThrough() as unknown as StubRequest;
  stream.method = method;
  stream.url = "/api/auth";
  stream.headers = { host: "localhost:5173", "content-type": "application/json", ...(cookie ? { cookie } : {}) } as unknown as IncomingMessage["headers"];
  process.nextTick(() => {
    if (body) stream.write(body);
    stream.end();
  });
  return stream;
};

type StubResponse = ServerResponse & { statusCode: number; cookies: string[]; headers: Record<string, string>; body: () => string };

const createResponse = () => {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  const cookies: string[] = [];
  const response = {
    statusCode: 0,
    headersSent: false,
    cookies,
    headers,
    setHeader: (name: string, value: string) => {
      const key = name.toLowerCase();
      if (key === "set-cookie") cookies.push(value);
      else headers[key] = value;
    },
    end: (chunk?: Buffer | string) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      response.headersSent = true;
      return response;
    },
    body: () => Buffer.concat(chunks).toString(),
  };
  return response as unknown as StubResponse;
};

const call = async (method: string, body = "", cookie?: string) => {
  const response = createResponse();
  await authEndpoint(createRequest(method, body, cookie), response as ServerResponse);
  return { response, payload: response.body() ? JSON.parse(response.body()) as Record<string, unknown> : {} };
};

const cookiePair = (response: StubResponse) => response.cookies.map((raw) => raw.split(";")[0]).join("; ");
const cookieName = (response: StubResponse, name: string) => parseCookies(response.cookies.find((raw) => raw.startsWith(`${name}=`))?.split(";")[0] ?? "")[name];

beforeEach(() => {
  resetLoginFailures();
  process.env.APP_PASSWORD = "open-sesame";
  process.env.SESSION_SECRET = "test-secret";
  delete process.env.WRITE_PASSWORD;
  delete process.env.APP_ALLOW_WRITES;
});

afterEach(() => {
  for (const key of ["APP_PASSWORD", "WRITE_PASSWORD", "SESSION_SECRET", "APP_ALLOW_WRITES"]) delete process.env[key];
});

describe("the app gate endpoint", () => {
  it("reports an anonymous visitor without failing", async () => {
    const { response, payload } = await call("GET");
    expect(response.statusCode).toBe(200);
    expect(payload).toEqual({ authenticated: false, writesEnabled: true, writeGranted: false });
  });

  it("sets a session cookie on the right password", async () => {
    const { response, payload } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    expect(response.statusCode).toBe(200);
    expect(payload).toEqual({ ok: true, authenticated: true, writesEnabled: true, writeGranted: true });
    expect(cookieName(response, SESSION_COOKIE)).toBeTruthy();
    expect(cookieName(response, WRITE_COOKIE)).toBeTruthy();
  });

  it("keeps the write cookie when a separate write password is set", async () => {
    process.env.WRITE_PASSWORD = "write-pass";
    const { response, payload } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    expect(payload.writeGranted).toBe(false);
    expect(cookieName(response, WRITE_COOKIE)).toBeUndefined();
    expect(cookieName(response, SESSION_COOKIE)).toBeTruthy();
  });

  it("refuses a wrong password", async () => {
    const { response, payload } = await call("POST", JSON.stringify({ password: "wrong" }));
    expect(response.statusCode).toBe(401);
    expect(payload.error).toBe("Wrong password");
  });

  it("refuses a body that is not json", async () => {
    const { response } = await call("POST", "not json");
    expect(response.statusCode).toBe(400);
  });

  it("blocks a visitor after five wrong attempts", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await call("POST", JSON.stringify({ password: "wrong" }));
    const { response, payload } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    expect(response.statusCode).toBe(429);
    expect(String(payload.error)).toContain("Too many attempts");
  });

  it("hands out the write grant to a visitor who knows the write password", async () => {
    process.env.WRITE_PASSWORD = "write-pass";
    const { response } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    const { payload } = await call("POST", JSON.stringify({ password: "write-pass", scope: "write" }), cookiePair(response));
    expect(payload).toEqual({ ok: true, writeGranted: true });
    expect(hasWriteGrant({ headers: { cookie: cookiePair(response) } } as IncomingMessage)).toBe(false);
  });

  it("does not hand the write grant to a visitor with only the app session", async () => {
    process.env.WRITE_PASSWORD = "write-pass";
    const { response } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    const { payload } = await call("POST", JSON.stringify({ password: "open-sesame", scope: "write" }), cookiePair(response));
    expect(payload.error).toBe("Wrong write password");
  });

  it("asks for a session before the write grant", async () => {
    const { response, payload } = await call("POST", JSON.stringify({ password: "write-pass", scope: "write" }));
    expect(response.statusCode).toBe(401);
    expect(payload.error).toBe("Sign in required");
  });

  it("refuses the write grant on a read only deployment", async () => {
    process.env.APP_ALLOW_WRITES = "false";
    const { response } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    const { payload } = await call("POST", JSON.stringify({ password: "open-sesame", scope: "write" }), cookiePair(response));
    expect(payload.error).toBe("This deployment is read only");
  });

  it("clears both cookies on sign out", async () => {
    const { response } = await call("DELETE");
    expect(response.statusCode).toBe(200);
    expect(response.cookies).toHaveLength(2);
    expect(response.cookies.every((raw) => raw.includes("Max-Age=0"))).toBe(true);
    expect(response.cookies.map((raw) => raw.split(";")[0])).toEqual([`${SESSION_COOKIE}=`, `${WRITE_COOKIE}=`]);
    expect(readSession({ headers: { cookie: "mc_session=anything" } } as IncomingMessage)).toBeNull();
  });

  it("accepts a session it issued itself", async () => {
    const { response } = await call("POST", JSON.stringify({ password: "open-sesame" }));
    const session = readSession({ headers: { cookie: cookiePair(response) } } as IncomingMessage);
    expect(session).not.toBeNull();
    expect(sessionCookie({ headers: { host: "localhost:5173" } } as IncomingMessage)).toContain(SESSION_COOKIE);
  });

  it("blocks every method but GET, POST and DELETE", async () => {
    const { response } = await call("PUT", "{}");
    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe("GET, POST, DELETE");
  });

  it("stays closed when no app password is configured", async () => {
    delete process.env.APP_PASSWORD;
    const { response, payload } = await call("GET");
    expect(response.statusCode).toBe(500);
    expect(payload.error).toContain("APP_PASSWORD");
  });

  it("refuses a cross origin sign in", async () => {
    const response = createResponse();
    const request = createRequest("POST", JSON.stringify({ password: "open-sesame" }));
    (request.headers as Record<string, string>).origin = "https://evil.example";
    await authEndpoint(request, response as ServerResponse);
    expect(response.statusCode).toBe(403);
    expect(response.cookies).toHaveLength(0);
  });
});