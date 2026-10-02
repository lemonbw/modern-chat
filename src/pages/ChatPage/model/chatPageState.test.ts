import { describe, expect, it } from "vitest";
import {
  errorMessage,
  initialsOf,
  mergeHistory,
  messageTime,
  placeholderConversation,
} from "./chatPageState";
import type { ChatMessage } from "../../../entities/chat/types";

const message = (overrides: Partial<ChatMessage> & { text: string }): ChatMessage => ({ time: "10:00", ...overrides });

describe("initialsOf", () => {
  it("takes the first two letters of the first two words", () => {
    expect(initialsOf("Leon Gray")).toBe("LG");
  });

  it("handles a single word", () => {
    expect(initialsOf("Telegram")).toBe("T");
  });

  it("falls back to a question mark for an empty name", () => {
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("mergeHistory", () => {
  it("keeps the local message that the history does not know yet", () => {
    const local = message({ text: "sending", status: "sending" });
    const merged = mergeHistory([message({ id: "1", text: "old" })], [local], new Set());
    expect(merged).toHaveLength(2);
    expect(merged[1]?.text).toBe("sending");
  });

  it("keeps the sending status when the history has no status", () => {
    const previous = message({ id: "1", text: "hi", status: "sending" });
    const merged = mergeHistory([message({ id: "1", text: "hi" })], [previous], new Set());
    expect(merged[0]?.status).toBe("sending");
  });

  it("marks a message deleted when its id is in the deleted set", () => {
    const merged = mergeHistory([message({ id: "9", text: "oops" })], [], new Set(["9"]));
    expect(merged[0]?.deleted).toBe(true);
    expect(merged[0]?.text).toBe("This message was deleted");
  });

  it("stays deleted even when the history brings it back", () => {
    const previous = message({ id: "9", text: "oops", deleted: true });
    const merged = mergeHistory([message({ id: "9", text: "oops" })], [previous], new Set());
    expect(merged[0]?.deleted).toBe(true);
  });
});

describe("errorMessage", () => {
  it("prefers the error text", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("falls back for unknown values", () => {
    expect(errorMessage({}, "fallback")).toBe("fallback");
  });
});

describe("helpers", () => {
  it("formats the local send time", () => {
    expect(messageTime()).toMatch(/\d{1,2}:\d{2}/);
  });

  it("builds a usable conversation before the chat list arrives", () => {
    const chat = placeholderConversation("-100123", 1);
    expect(chat.id).toBe("-100123");
    expect(chat.hasConversation).toBe(true);
    expect(chat.messages).toEqual([]);
  });
});