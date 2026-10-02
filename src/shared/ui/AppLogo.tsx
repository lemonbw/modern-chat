type AppLogoProps = { className?: string; title?: string };

/** Two speech bubbles on a rounded tile, the same markup as in `public/favicon.svg`. */
export const AppLogo = ({ className = "size-8", title = "Modern Chat" }: AppLogoProps) => (
  <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
    <defs>
      <linearGradient id="appLogoGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5aa9ff" />
        <stop offset="1" stopColor="#1668d8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="15" fill="url(#appLogoGradient)" />
    <g transform="translate(8 8) scale(2)" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
      <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
    </g>
  </svg>
);