import { useState } from "react";
import type { ChatMessageMedia } from "../../../entities/chat/types";

const MessageMedia = ({ media, alt }: { media: ChatMessageMedia; alt: string }) => {
  const [expanded, setExpanded] = useState(false);

  if (media.kind === "image") {
    const preview = media.thumbnail ?? media.url;
    return <>
      <button type="button" className="group relative mb-1 block max-w-full overflow-hidden rounded-md text-left" onClick={() => setExpanded(true)} aria-label={`Open image: ${alt}`}>
        <img
          src={preview}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="max-h-[min(52vh,380px)] max-w-full rounded-md object-contain"
        />
        {media.thumbnail && <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100" aria-hidden="true">⤢</span>}
      </button>
      {expanded && <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false); }}>
        <button type="button" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70" onClick={() => setExpanded(false)} aria-label="Close image">×</button>
        <img src={media.url} alt={alt} decoding="async" fetchPriority="high" className="max-h-[90vh] max-w-[min(96vw,1200px)] object-contain" />
      </div>}
    </>;
  }

  if (media.kind === "video") {
    return <video
      className="mb-1 max-h-[min(52vh,380px)] max-w-full rounded-md bg-black"
      src={media.url}
      poster={media.thumbnail}
      controls
      playsInline
      preload="none"
      aria-label={media.caption || "Video message"}
    >
      <source src={media.url} type={media.mimeType} />
    </video>;
  }

  return <audio
    className="mb-1 block w-[min(300px,70vw)] max-w-full"
    src={media.url}
    controls
    preload="none"
    aria-label={media.caption || media.fileName || "Audio message"}
  >
    <source src={media.url} type={media.mimeType} />
  </audio>;
};

export { MessageMedia };
