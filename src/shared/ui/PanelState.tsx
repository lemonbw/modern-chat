import { LuCircleAlert, LuRefreshCw } from "react-icons/lu";

type Props = {
  title: string;
  hint?: string;
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * What the chat area shows when there is nothing to scroll: a spinner while the first screen loads,
 * a retry button when the API could not be reached, and a hint otherwise. The UI stays usable in
 * every case, the panel never disappears behind a bare line of text.
 */
export const PanelState = ({ title, hint, error, onRetry, retryLabel = "Retry", className = "" }: Props) => (
  <div className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-chat-deep px-6 text-center text-sm text-[#a6b3bd] ${className}`}>
    {error
      ? <LuCircleAlert className="size-7 text-red-300" aria-hidden="true" />
      : <LuRefreshCw className="size-6 animate-spin text-chat-muted" aria-hidden="true" />}
    <p className="max-w-[36ch] text-[#dfe7ec]">{error ? title : hint ?? title}</p>
    {error
      ? <>
          <p role="alert" className="max-w-[46ch] text-xs text-red-300">{error}</p>
          {onRetry && <button className="mt-1 rounded-lg bg-chat-blue px-4 py-2 text-xs font-semibold text-white hover:bg-[#179cde]" onClick={onRetry}>{retryLabel}</button>}
        </>
      : null}
  </div>
);