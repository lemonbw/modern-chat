import { describe, expect, it } from "vitest";
import { buildMembers, buildTabItems, mediaCountLabel, membersCountLabel } from "./chatInfo";
import type { ChatMessage } from "../../../entities/chat/types";

const message = (overrides: Partial<ChatMessage> & { text: string }): ChatMessage => ({
  time: "12:00",
  timestamp: 1_700_000_000,
  ...overrides,
});

describe("buildTabItems", () => {
  const messages: ChatMessage[] = [
    message({ id: "1", text: "hello", media: { kind: "image", url: "photo.jpg" } }),
    message({ id: "2", text: "see https://example.com/page", media: { kind: "document", url: "doc.pdf", fileName: "doc.pdf" } }),
    message({ id: "3", text: "song", media: { kind: "audio", url: "track.mp3" } }),
    message({ id: "4", text: "clip", media: { kind: "video", url: "clip.mp4" } }),
  ];

  it("lists photos and videos for the media tab", () => {
    const items = buildTabItems(messages, "media");
    expect(items.map((item) => item.kind)).toEqual(["photo", "video"]);
  });

  it("hides photos when the filter is off", () => {
    const items = buildTabItems(messages, "media", { showPhotos: false });
    expect(items.map((item) => item.kind)).toEqual(["video"]);
  });

  it("hides videos when the filter is off", () => {
    const items = buildTabItems(messages, "media", { showVideos: false });
    expect(items.map((item) => item.kind)).toEqual(["photo"]);
  });

  it("returns nothing when both filters are off", () => {
    expect(buildTabItems(messages, "media", { showPhotos: false, showVideos: false })).toEqual([]);
  });

  it("collects documents for the files tab", () => {
    expect(buildTabItems(messages, "files").map((item) => item.title)).toEqual(["doc.pdf"]);
  });

  it("collects audio for the music tab", () => {
    expect(buildTabItems(messages, "music").map((item) => item.kind)).toEqual(["audio"]);
  });

  it("extracts links from the text", () => {
    expect(buildTabItems(messages, "links").map((item) => item.title)).toEqual(["https://example.com/page"]);
  });

  it("returns nothing for stories because the API has no stories", () => {
    expect(buildTabItems(messages, "stories")).toEqual([]);
  });
});

describe("mediaCountLabel", () => {
  const messages: ChatMessage[] = [
    message({ id: "1", text: "a", media: { kind: "image", url: "1.jpg" } }),
    message({ id: "2", text: "b", media: { kind: "image", url: "2.jpg" } }),
    message({ id: "3", text: "c", media: { kind: "video", url: "3.mp4" } }),
  ];

  it("pluralises photos and videos", () => {
    expect(mediaCountLabel(messages)).toBe("2 photos, 1 video");
  });

  it("drops the counts that are filtered out", () => {
    expect(mediaCountLabel(messages, { showVideos: false })).toBe("2 photos");
    expect(mediaCountLabel(messages, { showPhotos: false })).toBe("1 video");
  });
});

describe("buildMembers", () => {
  it("keeps the most recent entry per sender", () => {
    const messages: ChatMessage[] = [
      message({ id: "1", text: "hi", sender: "Ann", timestamp: 200 }),
      message({ id: "2", text: "hey", sender: "Ann", timestamp: 100 }),
      message({ id: "3", text: "yo", sender: "Bob", timestamp: 150 }),
    ];
    const members = buildMembers(messages);
    expect(members.map((member) => member.title)).toEqual(["Bob", "Ann"]);
    expect(members[0]?.subtitle).toBe("12:00");
  });

  it("ignores messages without a sender", () => {
    expect(buildMembers([message({ id: "1", text: "hi" })])).toEqual([]);
  });

  it("labels a single member in the singular", () => {
    expect(membersCountLabel(buildMembers([message({ text: "a", sender: "Ann" })]))).toBe("1 member");
  });
});