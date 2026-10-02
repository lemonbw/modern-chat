import { useState } from "react";
import type { ChatMessageMedia } from "../../../entities/chat/types";

const MessageMedia = ({ media, alt }: { media: ChatMessageMedia; alt: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(media.url);
      if (!response.ok) throw new Error("Failed to download image");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      const defaultName = media.fileName ?? media.url.split("/").pop()?.split("?")[0] ?? "image.jpg";
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Fallback in case of CORS or network error
      window.open(media.url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  if (media.kind === "sticker") {
    const stickerSource = media.thumbnail ?? (media.mimeType === "application/x-tgsticker" ? undefined : media.url);
    return stickerSource
      ? <img src={stickerSource} alt={alt} loading="lazy" decoding="async" fetchPriority="low" className="mb-1 max-h-40 max-w-40 object-contain" />
      : <span className="mb-1 block text-xs text-[#c0ccd4]">Sticker</span>;
  }

  if (media.kind === "image") {
    const previewSrc = media.url || media.thumbnail;
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
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full bg-black/50 text-lg text-white hover:bg-black/70 disabled:opacity-50"
            aria-label="Download image"
            title="Download image"
            disabled={downloading}
            onClick={handleDownload}
          >
            {downloading ? "…" : "⬇"}
          </button>
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
