type AppLogoProps = { className?: string; title?: string };

/** Brand mark: a bold C on the app gradient, matching public/favicon.svg. */
export const AppLogo = ({ className = "size-8", title = "Modern Chat" }: AppLogoProps) => (
  <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
    <defs>
      <linearGradient id="appLogoGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#36baf3" />
        <stop offset="1" stopColor="#1b8ecf" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="15" fill="url(#appLogoGradient)" />
    <path
      fill="#fff"
      d="M48.09 19.5A21 21 0 1 0 48.09 46.5L41.57 41.04A12.5 12.5 0 1 1 41.57 24.96Z"
    />
  </svg>
);