import { useEffect, useRef, useState } from "react";
import { getContactAvatar, getContactInfo } from "../../api/greenApiContacts";

const avatarStorageKey = "modern-chat-avatar-cache";

/**
 * A picture is cached forever, a contact without one for a week. GREEN-API gives roughly a hundred
 * avatar calls per month, so re-asking for a known answer would burn the quota for the whole account.
 */
const missingAvatarTtlMs = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = { source: string | null; at?: number };

const readCache = (): Map<string, CacheEntry> => {
  try {
    const raw = localStorage.getItem(avatarStorageKey);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, CacheEntry] => typeof entry[1] === "string" || (entry[1] as CacheEntry | undefined)?.source === null,
    );
    return new Map(entries.map(([key, value]) => [key, typeof value === "string" ? { source: value } : value]));
  } catch {
    return new Map();
  }
};

const avatarCache = readCache();

const writeCache = (chatId: string, source: string | null) => {
  avatarCache.set(chatId, source ? { source } : { source: null, at: Date.now() });
  try {
    localStorage.setItem(avatarStorageKey, JSON.stringify(Object.fromEntries(avatarCache.entries())));
  } catch {
    // Storage may be full; the in-memory copy still serves this session.
  }
};

const cachedSource = (chatId: string) => {
  const entry = avatarCache.get(chatId);
  if (!entry) return undefined;
  if (entry.source) return entry.source;
  return Date.now() - (entry.at ?? 0) > missingAvatarTtlMs ? undefined : null;
};

const toAvatarSource = (url?: string, base64?: string) => {
  if (url && url.startsWith("http")) return url;
  if (base64) {
    const clean = base64.trim().replace(/\s/g, "");
    return clean.startsWith("data:") ? clean : `data:image/jpeg;base64,${clean}`;
  }
  return null;
};

export const ContactAvatar = ({
  chatId,
  name,
  initials,
  color,
  avatar: externalAvatar,
  className = "avatar",
}: {
  chatId?: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string | null;
  className?: string;
}) => {
  const avatarRef = useRef<HTMLSpanElement>(null);
  const [avatar, setAvatar] = useState<string | null>(() => (chatId ? cachedSource(chatId) ?? null : null));

  useEffect(() => {
    if (externalAvatar) return;
    if (!chatId || avatarCache.has(chatId)) return;

    let isMounted = true;

    const applySource = (source: string | null) => {
      writeCache(chatId, source);
      if (isMounted) setAvatar(source);
    };

    const loadAvatar = async () => {
      // The contact card already carries the picture, so it is the cheaper of the two calls.
      const contactInfo = await getContactInfo(chatId).catch(() => null);
      const fromContact = toAvatarSource(contactInfo?.avatar, contactInfo?.base64Avatar);
      if (fromContact) {
        applySource(fromContact);
        return;
      }
      if (contactInfo) {
        // The card answered and had no picture, so the second call would waste the quota.
        applySource(null);
        return;
      }
      // Groups are not served by the contact endpoint and still need the avatar call.
      const result = await getContactAvatar(chatId).catch(() => null);
      const fromAvatar = toAvatarSource(result?.urlAvatar ?? undefined, result?.base64Avatar ?? undefined);
      applySource(fromAvatar);
    };

    if (!("IntersectionObserver" in window)) {
      void loadAvatar();
    } else {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        void loadAvatar();
        observer.disconnect();
      });
      const element = avatarRef.current;
      if (element) observer.observe(element);
      return () => {
        isMounted = false;
        observer.disconnect();
      };
    }

    return () => { isMounted = false; };
  }, [chatId, externalAvatar]);

  const currentAvatar = externalAvatar || avatar;
  return (
    <span ref={avatarRef} className={`${className} overflow-hidden`} style={{ background: color }}>
      {currentAvatar ? (
        <img
          className="size-full object-cover"
          src={currentAvatar}
          alt={`${name} profile`}
          loading="lazy"
          decoding="async"
          onError={() => {
            writeCache(chatId ?? "", null);
            setAvatar(null);
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
};