import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      create: () => ({
        get: (...args: unknown[]) => getMock(...args),
        post: (...args: unknown[]) => postMock(...args),
        interceptors: { response: { use: () => undefined } },
      }),
    },
  };
});

const { getContactInfo, getContactAvatar } = await import("../src/features/contacts/api/greenApiContacts");

describe("contact lookups", () => {
  beforeEach(() => {
    localStorage.clear();
    postMock.mockReset();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks GREEN-API once for a contact card", async () => {
    postMock.mockResolvedValue({ data: { name: "Leon Gray", avatar: "https://example.com/a.jpg" } });
    const info = await getContactInfo("1907442184");
    expect(info?.name).toBe("Leon Gray");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("serves the second call from the cache", async () => {
    postMock.mockResolvedValue({ data: { name: "Cached User" } });
    await getContactInfo("cache-user");
    await getContactInfo("cache-user");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("caches a contact without a picture instead of asking again", async () => {
    postMock.mockResolvedValue({ data: { name: "No Avatar" } });
    await getContactInfo("111");
    await getContactInfo("111");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("answers with null when the monthly quota is gone", async () => {
    postMock.mockRejectedValue(Object.assign(new Error("quota"), { isAxiosError: true, response: { status: 466 } }));
    await expect(getContactInfo("222")).resolves.toBeNull();
  });

  it("answers with null when the avatar quota is gone", async () => {
    postMock.mockRejectedValue(Object.assign(new Error("quota"), { isAxiosError: true, response: { status: 466 } }));
    await expect(getContactAvatar("333")).resolves.toBeNull();
  });

  it("rethrows a real failure", async () => {
    postMock.mockRejectedValue(Object.assign(new Error("server"), { isAxiosError: true, response: { status: 500 } }));
    await expect(getContactInfo("444")).rejects.toThrow("server");
  });
});