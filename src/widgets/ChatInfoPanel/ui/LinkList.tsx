import { useEffect, useState } from "react";
import type { InfoItem } from "../../../features/contacts/model/chatInfo";
import { loadLinkPreview, previewFor, type LinkPreview } from "../../../features/search-chats/model/linkPreviews";

const thumbnail = "size-[52px] shrink-0 rounded-md object-cover";

/** One row per link: the picture from the OpenGraph tag on the left, the site and the url on the right. */
export const LinkList = ({ items, hasMore, onLoadMore }: { items: InfoItem[]; hasMore: boolean; onLoadMore: () => void }) => (
  <div
    onScroll={(event) => {
      const list = event.currentTarget;
      if (list.scrollHeight - list.scrollTop - list.clientHeight < 120) onLoadMore();
    }}
    className="flex flex-col p-2"
  >
    {items.map((item) => <LinkRow key={item.id} url={item.url ?? item.title} />)}
    {!hasMore && items.length > 0 && null}
  </div>
);

const LinkRow = ({ url }: { url: string }) => {
  const [preview, setPreview] = useState<LinkPreview>(() => {
    const known = previewFor(url);
    return { ...known, title: known.siteName };
  });

  useEffect(() => {
    let isMounted = true;
    void loadLinkPreview(url).then((loaded) => {
      if (isMounted && loaded) setPreview(loaded);
    });
    return () => { isMounted = false; };
  }, [url]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center gap-3 rounded-lg border-0 bg-transparent p-2 text-left hover:bg-[#253441]"
    >
      {preview.image
        ? <img src={preview.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={thumbnail} />
        : <span aria-hidden="true" className={`${thumbnail} bg-[#1b2734]`} />}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-[#e5edf3]">{preview.siteName}</span>
        <span className="block truncate text-xs text-[#8fa1ae]">{preview.title}</span>
      </span>
    </a>
  );
};