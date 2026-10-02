import { useState } from "react";
import type { ChatMessage } from "../../../entities/chat/types";

const maxResults = 40;

/** In-chat search: keeps the query, the matching list and the closing rules of the search field. */
export const useChatSearch = (messages: ChatMessage[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLocaleLowerCase();
  const results = normalized
    ? messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => !message.deleted && message.text.toLocaleLowerCase().includes(normalized))
      .reverse()
      .slice(0, maxResults)
    : [];

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  const open = () => setIsOpen(true);

  return { isOpen, query, setQuery, normalized, results, open, close };
};