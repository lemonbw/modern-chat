import { useState } from "react";

type Country = { name: string; code: string; iso: string };

const countries: Country[] = [
  { name: "Kazakhstan", code: "+7", iso: "KZ" }, { name: "Russia", code: "+7", iso: "RU" },
  { name: "United States", code: "+1", iso: "US" }, { name: "Canada", code: "+1", iso: "CA" },
  { name: "United Kingdom", code: "+44", iso: "GB" }, { name: "Germany", code: "+49", iso: "DE" },
  { name: "France", code: "+33", iso: "FR" }, { name: "India", code: "+91", iso: "IN" },
  { name: "China", code: "+86", iso: "CN" }, { name: "Japan", code: "+81", iso: "JP" },
  { name: "South Korea", code: "+82", iso: "KR" }, { name: "Australia", code: "+61", iso: "AU" },
  { name: "New Zealand", code: "+64", iso: "NZ" }, { name: "Brazil", code: "+55", iso: "BR" },
  { name: "Mexico", code: "+52", iso: "MX" }, { name: "Argentina", code: "+54", iso: "AR" },
  { name: "Turkey", code: "+90", iso: "TR" }, { name: "Ukraine", code: "+380", iso: "UA" },
  { name: "Uzbekistan", code: "+998", iso: "UZ" }, { name: "Kyrgyzstan", code: "+996", iso: "KG" },
  { name: "Tajikistan", code: "+992", iso: "TJ" }, { name: "Georgia", code: "+995", iso: "GE" },
  { name: "Armenia", code: "+374", iso: "AM" }, { name: "Azerbaijan", code: "+994", iso: "AZ" },
  { name: "Belarus", code: "+375", iso: "BY" }, { name: "Poland", code: "+48", iso: "PL" },
  { name: "Italy", code: "+39", iso: "IT" }, { name: "Spain", code: "+34", iso: "ES" },
  { name: "Netherlands", code: "+31", iso: "NL" }, { name: "Belgium", code: "+32", iso: "BE" },
  { name: "Switzerland", code: "+41", iso: "CH" }, { name: "Austria", code: "+43", iso: "AT" },
  { name: "Sweden", code: "+46", iso: "SE" }, { name: "Norway", code: "+47", iso: "NO" },
  { name: "Denmark", code: "+45", iso: "DK" }, { name: "Finland", code: "+358", iso: "FI" },
  { name: "Portugal", code: "+351", iso: "PT" }, { name: "Greece", code: "+30", iso: "GR" },
  { name: "Israel", code: "+972", iso: "IL" }, { name: "United Arab Emirates", code: "+971", iso: "AE" },
  { name: "Saudi Arabia", code: "+966", iso: "SA" }, { name: "Egypt", code: "+20", iso: "EG" },
  { name: "South Africa", code: "+27", iso: "ZA" }, { name: "Nigeria", code: "+234", iso: "NG" },
  { name: "Indonesia", code: "+62", iso: "ID" }, { name: "Pakistan", code: "+92", iso: "PK" },
  { name: "Bangladesh", code: "+880", iso: "BD" }, { name: "Thailand", code: "+66", iso: "TH" },
  { name: "Vietnam", code: "+84", iso: "VN" }, { name: "Philippines", code: "+63", iso: "PH" },
  { name: "Singapore", code: "+65", iso: "SG" }, { name: "Malaysia", code: "+60", iso: "MY" },
  { name: "Chile", code: "+56", iso: "CL" }, { name: "Colombia", code: "+57", iso: "CO" },
  { name: "Peru", code: "+51", iso: "PE" }, { name: "Ireland", code: "+353", iso: "IE" },
  { name: "Iceland", code: "+354", iso: "IS" }, { name: "Romania", code: "+40", iso: "RO" },
  { name: "Czechia", code: "+420", iso: "CZ" }, { name: "Hungary", code: "+36", iso: "HU" },
];

const countryFlag = (iso: string) => String.fromCodePoint(...iso.split("").map((letter) => 127397 + letter.charCodeAt(0)));

const formatNumber = (digits: string, dialCode: string) => {
  const prefix = dialCode.replace("+", "");
  const national = digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
  const groups = dialCode === "+7" || dialCode === "+1" ? [3, 3, 2, 2] : national.length > 10 ? [3, 3, 4, 4] : [3, 3, 4];
  const chunks: string[] = [];
  let offset = 0;
  for (const size of groups) {
    if (offset >= national.length) break;
    chunks.push(national.slice(offset, offset + size));
    offset += size;
  }
  if (offset < national.length) chunks.push(national.slice(offset));
  return [dialCode, ...chunks].join(" ");
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export const PhoneNumberInput = ({ id, value, onChange, required, disabled, className = "", "aria-label": ariaLabel = "Phone number" }: Props) => {
  const [country, setCountry] = useState(countries[0]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const digits = value.replace(/\D/g, "");
  const prefix = country.code.replace("+", "");
  const national = digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
  const isEditingCallingCode = value.startsWith("+") && !digits.startsWith(prefix);
  const formatted = digits ? isEditingCallingCode ? value : formatNumber(digits, country.code) : "";
  const displayValue = formatted || (isEditingCallingCode ? value : country.code);
  const mask = country.code === "+7" ? "000 000 00 00" : country.code === "+1" ? "000 000 0000" : "000 000 0000";
  const hint = (() => {
    if (isEditingCallingCode) return "";
    const sizes = mask.split(" ").map((chunk) => chunk.length);
    let consumed = 0;
    const tail: string[] = [];
    for (const size of sizes) {
      if (national.length >= consumed + size) { consumed += size; continue; }
      const enteredInChunk = Math.max(0, national.length - consumed);
      const separator = tail.length > 0 || enteredInChunk === 0 ? " " : "";
      tail.push(`${separator}${"0".repeat(size - enteredInChunk)}`);
      consumed += size;
    }
    return tail.join("");
  })();
  const filtered = countries.filter((item) => `${item.name} ${item.code} ${item.iso}`.toLowerCase().includes(query.toLowerCase().trim()));

  const update = (raw: string) => {
    const nextDigits = raw.replace(/\D/g, "").slice(0, 15);
    const typedPlus = raw.trim().startsWith("+");
    if (!nextDigits) { onChange(typedPlus ? "+" : ""); return; }
    if (typedPlus) {
      const match = [...countries].sort((a, b) => b.code.length - a.code.length).find((item) => nextDigits.startsWith(item.code.slice(1)));
      const exactMatch = match && nextDigits.length >= match.code.length - 1 ? match : undefined;
      if (exactMatch) {
        setCountry(exactMatch);
        onChange(formatNumber(nextDigits, exactMatch.code));
      } else {
        onChange(`+${nextDigits}`);
      }
    } else {
      onChange(formatNumber(nextDigits.startsWith(prefix) ? nextDigits : `${prefix}${nextDigits}`, country.code));
    }
  };

  const chooseCountry = (item: Country) => {
    setCountry(item);
    const subscriber = national;
    onChange(subscriber ? formatNumber(`${item.code.slice(1)}${subscriber}`, item.code) : "");
    setOpen(false);
    setQuery("");
  };

  return <div className={`relative flex h-11 w-full items-center rounded-lg border border-[#40505c] bg-[#202c37] focus-within:border-[#43b2e5] focus-within:shadow-[0_0_0_3px_#2aabee1c] ${className}`}>
    <button type="button" className="h-full shrink-0 rounded-l-lg px-3 text-sm font-medium text-[#dbe8ef] hover:bg-white/5" onClick={() => setOpen((current) => !current)} aria-label={`Choose country calling code, current ${country.name} ${country.code}`} aria-expanded={open} disabled={disabled}>{countryFlag(country.iso)}⌄</button>
    <div className="relative min-w-0 flex-1 font-mono text-[14px] leading-5 tracking-normal">
      {hint && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-pre font-mono text-[14px] leading-5 font-normal tracking-normal"><span className="text-transparent">{displayValue}</span><span className="text-[#82919b]">{hint}</span></span>}
      <input id={id} type="tel" inputMode="tel" autoComplete="tel" aria-label={ariaLabel} value={displayValue} onChange={(event) => update(event.target.value)} required={required} disabled={disabled} className="relative h-full w-full bg-transparent px-0 pr-3 font-mono text-[14px] leading-5 font-normal tracking-normal text-[#eaf2f7] outline-none placeholder:text-transparent" />
    </div>
    {open && <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-lg border border-[#40505c] bg-[#202c37] shadow-xl">
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search country or code" className="w-full border-b border-[#40505c] bg-transparent px-3 py-2.5 text-sm text-[#eaf2f7] outline-none placeholder:text-[#82919b]" />
      <ul role="listbox" className="max-h-56 overflow-y-auto py-1">{filtered.map((item) => <li key={item.iso}><button type="button" role="option" aria-selected={item.iso === country.iso} onClick={() => chooseCountry(item)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#eaf2f7] hover:bg-[#2b3b48]"><span>{item.name}</span><span className="text-[#9cabb5]">{item.code}</span></button></li>)}{filtered.length === 0 && <li className="px-3 py-3 text-sm text-[#9cabb5]">No countries found</li>}</ul>
    </div>}
  </div>;
};
