import { useEffect, useRef, useState } from "react";
import { getContactAvatar, getContactInfo } from "../../api/greenApiContacts";

const avatarStorageKey = "modern-chat-avatar-cache";

const loadAvatarCache = (): Map<string, string | null> => {
  try {
    const raw = localStorage.getItem(avatarStorageKey);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
};

const avatarCache = loadAvatarCache();
let quotaExceeded = false;

const saveAvatarToCache = (chatId: string, source: string | null) => {
  avatarCache.set(chatId, source);
  try {
    const obj = Object.fromEntries(avatarCache.entries());
    localStorage.setItem(avatarStorageKey, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
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
  const [avatar, setAvatar] = useState<string | null>(() => {
    if (chatId && avatarCache.has(chatId)) {
      return avatarCache.get(chatId) ?? null;
    }
    return null;
  });

  useEffect(() => {
    if (externalAvatar || !chatId || avatarCache.has(chatId) || quotaExceeded) return;

    let isMounted = true;
    const loadAvatar = async () => {
      let source: string | null = null;
      try {
        const info = await getContactAvatar(chatId);
        source = toAvatarSource(info?.urlAvatar ?? undefined, info?.base64Avatar ?? undefined);
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "response" in err) {
          const res = (err as { response?: { status?: number } }).response;
          if (res?.status === 466) {
            quotaExceeded = true;
          }
        }
      }
      if (!source && !quotaExceeded) {
        try {
          const contactInfo = await getContactInfo(chatId);
          source = toAvatarSource(contactInfo?.avatar, contactInfo?.base64Avatar);
        } catch (err: unknown) {
          if (typeof err === "object" && err !== null && "response" in err) {
            const res = (err as { response?: { status?: number } }).response;
            if (res?.status === 466) {
              quotaExceeded = true;
            }
          }
        }
      }

      saveAvatarToCache(chatId, source);
      if (isMounted) setAvatar(source);
    };

    if (!("IntersectionObserver" in window)) {
      void loadAvatar();
      return () => { isMounted = false; };
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        void loadAvatar();
        observer.disconnect();
      }
    });

    const el = avatarRef.current;
    if (el) observer.observe(el);

    return () => {
      isMounted = false;
      observer.disconnect();
    };
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
              if (chatId) saveAvatarToCache(chatId, null);
              setAvatar(null);
            }}
          />
        ) : (
          initials
        )}
      </span>
    );
};
