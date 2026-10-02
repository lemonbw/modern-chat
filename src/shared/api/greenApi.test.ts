import { describe, expect, it, beforeEach, vi } from "vitest";
import { greenApiUrl } from "./greenApiConfig";
import { isMethodPaused, pauseMethod, quotaErrorStatus } from "./quotaGuard";

describe("greenApiUrl", () => {
  it("never exposes the instance or the token", () => {
    const url = greenApiUrl("getChats");
    expect(url).toBe("/api/greenapi/getChats");
    expect(url).not.toMatch(/waInstance/);
    expect(url).not.toMatch(/token/i);
  });

  it("passes an unknown method through", () => {
    expect(greenApiUrl("someNewMethod")).toBe("/api/greenapi/someNewMethod");
  });

  it("maps the known methods", () => {
    expect(greenApiUrl("getChatHistory")).toBe("/api/greenapi/getChatHistory");
  });
});

describe("quotaGuard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("reports no pause for a fresh method", () => {
    expect(isMethodPaused("getAvatar")).toBe(false);
  });

  it("remembers a paused method", () => {
    pauseMethod("getAvatar");
    expect(isMethodPaused("getAvatar")).toBe(true);
  });

  it("expires the pause so a method can recover", () => {
    vi.useFakeTimers();
    pauseMethod("getChatHistory");
    vi.advanceTimersByTime(7 * 60 * 60 * 1000);
    expect(isMethodPaused("getChatHistory")).toBe(false);
  });

  it("uses the GREEN-API quota status", () => {
    expect(quotaErrorStatus).toBe(466);
  });
});