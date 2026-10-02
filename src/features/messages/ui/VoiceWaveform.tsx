const visibleBars = 42;
const minBarPercent = 12;

export const VoiceWaveform = ({ peaks, muted }: { peaks: number[]; muted?: boolean }) => {
  const bars = peaks.slice(-visibleBars);
  return (
    <div
      className={`flex h-[35px] min-w-0 flex-1 items-center gap-[2px] overflow-hidden ${muted ? "opacity-50" : ""}`}
      role="img"
      aria-label="Recording waveform"
    >
      {bars.length === 0
        ? <span className="h-[2px] w-full rounded-full bg-chat-muted" />
        : bars.map((peak, index) => (
          <span
            key={index}
            className="w-[2px] shrink-0 rounded-full bg-chat-blue transition-[height] duration-100 ease-out"
            style={{ height: `${Math.max(minBarPercent, Math.round(peak * 100))}%` }}
          />
        ))}
    </div>
  );
};
