import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatList } from "./ChatList";
import type { Conversation } from "../../../../entities/chat/types";
import { messageDateLabel } from "../../../../shared/lib/messageDate";

vi.mock("../../../contacts/ui/components/ContactAvatar", () => ({
  ContactAvatar: ({ initials }: { initials: string }) => <span data-testid="avatar">{initials}</span>,
}));

const chat = (overrides: Partial<Conversation>): Conversation => ({
  id: "1",
  name: "Ann",
  initials: "AN",
  color: "#000",
  preview: "hello",
  time: "12:00",
  messages: [],
  ...overrides,
});

describe("ChatList", () => {
  it("shows the send time of the message", () => {
    render(<ChatList chats={[chat({})]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("shows the unread count below the time", () => {
    render(<ChatList chats={[chat({ unread: 7 })]} selected={null} onSelect={() => {}} />);
    expect(screen.getByLabelText("7 unread").textContent).toBe("7");
  });

  it("hides the badge when everything is read", () => {
    render(<ChatList chats={[chat({ unread: 0 })]} selected={null} onSelect={() => {}} />);
    expect(screen.queryByLabelText(/unread/)).toBeNull();
  });

  it("caps the badge at 99+", () => {
    render(<ChatList chats={[chat({ unread: 150 })]} selected={null} onSelect={() => {}} />);
    expect(screen.getByLabelText("99+ unread").textContent).toBe("99+");
  });

  it("prefixes the sender in a group chat", () => {
    render(<ChatList chats={[chat({ group: true, sender: "Ann", preview: "hello" })]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText((_, element) => element?.textContent === "Ann: hello")).toBeTruthy();
  });

  it("does not prefix the sender in a personal chat", () => {
    render(<ChatList chats={[chat({ sender: "Ann", preview: "hello" })]} selected={null} onSelect={() => {}} />);
    expect(screen.queryByText("Ann: ")).toBeNull();
  });

  it("renders the date of the last message", () => {
    const lastTimestamp = Math.floor(Date.now() / 1000);
    const { container } = render(<ChatList chats={[chat({ lastTimestamp })]} selected={null} onSelect={() => {}} />);
    expect(container.textContent).toContain(messageDateLabel(lastTimestamp));
  });

  it("leaves the date empty when the timestamp is unknown", () => {
    const { container } = render(<ChatList chats={[chat({})]} selected={null} onSelect={() => {}} />);
    expect(container.textContent).not.toContain("undefined");
  });

  it("calls onSelect when a chat is clicked", () => {
    const onSelect = vi.fn();
    render(<ChatList chats={[chat({ id: "42" })]} selected={null} onSelect={onSelect} />);
    screen.getByRole("button").click();
    expect(onSelect).toHaveBeenCalledWith("42");
  });

  it("shows a loading hint instead of an empty list", () => {
    const { container } = render(<ChatList chats={[]} selected={null} onSelect={() => {}} loading />);
    expect(container.textContent).toContain("Checking conversations");
  });

  it("shows an empty state when the search finds nothing", () => {
    const { container } = render(<ChatList chats={[]} selected={null} onSelect={() => {}} />);
    expect(container.textContent).toContain("No chats found");
  });
});