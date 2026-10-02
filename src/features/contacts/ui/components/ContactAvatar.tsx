import { useEffect, useRef, useState } from "react";
import { getContactAvatar, getContactInfo } from "../../api/greenApiContacts";

const avatarCache = new Map<string, string | null>();
const avatarFallbacks = new Map<string, string>();

const toAvatarSource = (url?: string, base64?: string) => {
  if (url) return url;
  if (base64) {
    const normalizedBase64 = base64.trim().replace(/\s/g, "");
    return normalizedBase64.startsWith("data:") ? normalizedBase64 : `data:image/jpeg;base64,${normalizedBase64}`;
  }
  return null;
};

const toAvatarDataUrl = (base64?: string) => {
  if (!base64) return null;
  const normalizedBase64 = base64.trim().replace(/\s/g, "");
  return normalizedBase64.startsWith("data:") ? normalizedBase64 : `data:image/jpeg;base64,${normalizedBase64}`;
};

export const ContactAvatar = ({ chatId, name, initials, color, className = "avatar" }: {
  chatId: string;
  name: string;
  initials: string;
  color: string;
  className?: string;
}) => {
  const avatarRef = useRef<HTMLSpanElement>(null);
  const [avatar, setAvatar] = useState(() => avatarCache.get(chatId) ?? null);
  const hasCachedAvatar = avatarCache.has(chatId);

  useEffect(() => {
    if (hasCachedAvatar) return;
    const element = avatarRef.current;
    if (!element) return;
    let isMounted = true;
    const requestAvatar = () => {
      void (async () => {
        let source: string | null = null;
        try {
          const avatarInfo = await getContactAvatar(chatId);
          source = toAvatarSource(avatarInfo?.urlAvatar ?? undefined, avatarInfo?.base64Avatar ?? undefined);
          const avatarFallback = toAvatarDataUrl(avatarInfo?.base64Avatar ?? undefined);
          if (avatarInfo?.urlAvatar && avatarFallback) avatarFallbacks.set(chatId, avatarFallback);
        } catch {
          // GetAvatar can be unavailable for a contact; GetContactInfo is the fallback for personal chats.
        }
        if (!source) {
          try {
            const info = await getContactInfo(chatId);
            source = toAvatarSource(info?.avatar, info?.base64Avatar);
            const avatarFallback = toAvatarDataUrl(info?.base64Avatar);
            if (info?.avatar && avatarFallback) avatarFallbacks.set(chatId, avatarFallback);
          } catch {
            // Keep the initials fallback if neither avatar endpoint is available.
          }
        }
        avatarCache.set(chatId, source);
        if (isMounted) setAvatar(source);
      })().catch(() => {
        if (isMounted) setAvatar(null);
      });
    };
    if (!("IntersectionObserver" in window)) {
      requestAvatar();
      return () => { isMounted = false; };
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        requestAvatar();
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => { isMounted = false; observer.disconnect(); };
  }, [chatId, hasCachedAvatar]);

  return <span ref={avatarRef} className={`${className} overflow-hidden`} style={{ background: color }}>
    {avatar ? <img className="size-full object-cover" src={avatar} alt={`${name} profile`} loading="lazy" decoding="async" fetchPriority="low" onError={() => {
      const fallback = avatarFallbacks.get(chatId);
      if (fallback && fallback !== avatar) {
        avatarCache.set(chatId, fallback);
        setAvatar(fallback);
        return;
      }
      avatarCache.set(chatId, null);
      setAvatar(null);
    }} /> : initials}
  </span>;
};
