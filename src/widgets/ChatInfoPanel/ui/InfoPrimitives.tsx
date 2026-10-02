import { memo } from "react";
export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-[22px] w-[38px] shrink-0 rounded-full border-0 transition-colors ${checked ? "bg-chat-blue" : "bg-[#3a4b59]"}`}
  >
    <span className={`absolute top-[2px] size-[18px] rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-[2px]"}`} />
  </button>
);

export const InfoRow = memo(({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="shrink-0 text-[#8fa1ae]">{label}</span>
    <span className="min-w-0 truncate text-right text-[#e5edf3]">{value ? String(value) : "—"}</span>
  </div>
));

export const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[#8fa1ae]">{label}</span>
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-[#2c3b49] bg-[#202b36] px-2.5 py-2 text-sm text-[#e5edf3] outline-none focus:border-[#43b2e5]"
    />
  </label>
);
