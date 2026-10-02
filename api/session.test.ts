import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkPassword,
  clearedCookies,
  hasWriteGrant,
  newSession,
  newWriteGrant,
  parseCookies,
  readSession,
  SESSION_COOKIE,
  sessionCookie,
  sessionSecret,
  signToken,
  verifyToken,
  writeCookie,
  WRITE_COOKIE,
  writesEnabled,
} from "./_session.ts";

const request = (host = "chat.example.com") => ({ headers: { host } }) as IncomingMessage;

const cookieHeader = (header: string, name: string) => `${name}=${parseCookies(header.split(";")[0])[name]}`;

beforeEach(() => {
  process.env.APP_PASSWORD = "open-sesame";
  process.env.SESSION_SECRET = "test-secret";
  delete process.env.WRITE_PASSWORD;
  delete process.env.APP_ALLOW_WRITES;
});

afterEach(() => {
  delete process.env.APP_PASSWORD;
  delete process.env.SESSION_SECRET;
  delete process.env.WRITE_PASSWORD;
  delete process.env.APP_ALLOW_WRITES;
});

describe("parseCookies", () => {
  it("reads the cookies out of the header", () => {
    expect(parseCookies("a=1; mc_session=token; b=2")).toEqual({ a: "1", mc_session: "token", b: "2" });
  });

  it("survives a header that is missing or broken", () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies(";=;novalue")).toEqual({});
  });

  it("decodes an encoded value", () => {
    expect(parseCookies("mc_session=a%2Eb")).toEqual({ mc_session: "a.b" });
  });
});

describe("token signing", () => {
  it("accepts a token it signed", () => {
    const token = signToken(newSession(), sessionSecret());
    expect(verifyToken(token, sessionSecret())).not.toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signToken(newSession(), sessionSecret());
    const [body, signature] = token.split(".");
    const forged = Buffer.from(signature, "base64url");
    forged[0] ^= 0xff;
    expect(verifyToken(`${body}.${forged.toString("base64url")}`, sessionSecret())).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = signToken(newSession(), "other-secret");
    expect(verifyToken(token, sessionSecret())).toBeNull();
  });

  it("rejects a payload that was edited after signing", () => {
    const token = signToken(newSession(), sessionSecret());
    const [body, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, number>;
    const edited = Buffer.from(JSON.stringify({ ...payload, exp: payload.exp + 86_400 }), "utf8").toString("base64url");
    expect(verifyToken(`${edited}.${signature}`, sessionSecret())).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = { v: 1 as const, iat: 1, exp: 2 };
    expect(verifyToken(signToken(expired, sessionSecret()), sessionSecret())).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyToken(undefined, sessionSecret())).toBeNull();
    expect(verifyToken("not-a-token", sessionSecret())).toBeNull();
  });
});

describe("checkPassword", () => {
  it("accepts the right password only", () => {
    expect(checkPassword("open-sesame", "open-sesame")).toBe(true);
    expect(checkPassword("Open-sesame", "open-sesame")).toBe(false);
  });

  it("refuses empty values on both sides", () => {
    expect(checkPassword("open-sesame", "")).toBe(false);
    expect(checkPassword("", "open-sesame")).toBe(false);
    expect(checkPassword(undefined, "open-sesame")).toBe(false);
  });
});

describe("session and write grant cookies", () => {
  it("carries a session that the server accepts", () => {
    const header = sessionCookie(request());
    expect(header).toContain(`${SESSION_COOKIE}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");

    const session = readSession({ headers: { host: "chat.example.com", cookie: cookieHeader(header, SESSION_COOKIE) } } as IncomingMessage);
    expect(session).not.toBeNull();
  });

  it("stays usable over plain http on localhost", () => {
    expect(sessionCookie(request("localhost:5173"))).not.toContain("Secure");
  });

  it("refuses a session cookie it did not issue", () => {
    process.env.SESSION_SECRET = "another-secret";
    expect(readSession({ headers: { host: "chat.example.com", cookie: "mc_session=forged" } } as IncomingMessage)).toBeNull();
  });

  it("keeps the write grant apart from the session", () => {
    const headers = { host: "chat.example.com" } as Record<string, string>;
    expect(hasWriteGrant({ headers } as IncomingMessage)).toBe(false);
    headers.cookie = cookieHeader(writeCookie(request()), WRITE_COOKIE);
    expect(hasWriteGrant({ headers } as IncomingMessage)).toBe(true);
    expect(hasWriteGrant({ headers: { host: "chat.example.com", cookie: cookieHeader(sessionCookie(request()), SESSION_COOKIE) } } as IncomingMessage)).toBe(false);
  });

  it("expires the write grant in an hour", () => {
    expect(newWriteGrant().exp - newWriteGrant().iat).toBe(3600);
  });

  it("clears both cookies on sign out", () => {
    const cleared = clearedCookies(request()).join(" ");
    expect(cleared).toContain(`${SESSION_COOKIE}=;`);
    expect(cleared).toContain(`${WRITE_COOKIE}=;`);
    expect(cleared).toContain("Max-Age=0");
  });
});

describe("writesEnabled", () => {
  it("allows writes unless the deployment says otherwise", () => {
    expect(writesEnabled()).toBe(true);
    process.env.APP_ALLOW_WRITES = "false";
    expect(writesEnabled()).toBe(false);
  });
});