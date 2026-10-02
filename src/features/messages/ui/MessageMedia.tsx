import { memo, useState } from "react";
import type { MediaDescriptor } from "../model/mediaCache";

/** One attachment. Memoised, the descriptor and the alt text are stable per message. */
const MessageMedia = memo(({ descriptor, alt }: { descriptor: MediaDescriptor; alt: string }) => {
  const { media, previewSource, downloadFileName } = descriptor;
  const [expanded, setExpanded] = useState(false);

  if (media.kind === "sticker") {
    const stickerSource = previewSource;
    return stickerSource
      ? <img src={stickerSource} alt={alt} loading="lazy" decoding="async" fetchPriority="low" className="mb-1 max-h-40 max-w-40 object-contain" />
      : <span className="mb-1 block text-xs text-[#c0ccd4]">Sticker</span>;
  }

  if (media.kind === "image") {
    const previewSrc = previewSource;
    return <>
      <button
        type="button"
        className="group relative mb-1 block max-w-full overflow-hidden rounded-md text-left"
        onClick={() => setExpanded(true)}
        aria-label={`Open image: ${alt}`}
      >
        <img
          src={previewSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="max-h-[min(52vh,380px)] max-w-full rounded-md object-contain"
          style={media.thumbnail ? { backgroundImage: `url(${media.thumbnail})`, backgroundSize: "cover" } : undefined}
          onError={(e) => {
            if (media.thumbnail && e.currentTarget.src !== media.thumbnail) {
              e.currentTarget.src = media.thumbnail;
            }
          }}
        />
        <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100" aria-hidden="true">⤢</span>
      </button>
      {expanded && <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false); }}>
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <a
            href={media.url}
            download={downloadFileName}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-10 place-items-center rounded-full bg-black/50 text-lg text-white hover:bg-black/70"
            aria-label="Download image"
            title="Download image"
            onClick={(event) => event.stopPropagation()}
          >
            ⬇
          </a>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70"
            onClick={() => setExpanded(false)}
            aria-label="Close image"
            title="Close"
          >
            ×
          </button>
        </div>
        <img src={media.url || media.thumbnail} alt={alt} decoding="async" fetchPriority="high" className="max-h-[90vh] max-w-[min(96vw,1200px)] object-contain" />
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

  if (media.kind === "document") {
    return <a
      href={media.url}
      download={media.fileName ?? true}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1 flex items-center gap-2.5 rounded-lg border border-[#2c3b49] bg-[#1b2734] px-2.5 py-2 text-inherit no-underline hover:bg-[#22303d]"
      aria-label={`Download document: ${media.fileName ?? "document"}`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#2b3b49] text-lg" aria-hidden="true">📄</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-[#e5edf3]">{media.fileName ?? "Document"}</span>
        <span className="block truncate text-micro text-[#8fa1ae]">{media.mimeType ?? "File"}</span>
      </span>
      <span className="shrink-0 text-lg text-[#8fa1ae]" aria-hidden="true">⬇</span>
    </a>;
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
});

export { MessageMedia };
