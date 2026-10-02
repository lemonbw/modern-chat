const dayFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dayWithYearFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

const toDate = (timestamp?: number) => (timestamp ? new Date(timestamp * 1000) : new Date());

const labels = new Map<string, string>();

export const messageDateLabel = (timestamp?: number) => {
  const date = toDate(timestamp);
  const year = date.getFullYear();
  const key = `${year}-${date.getMonth()}-${date.getDate()}`;
  const cached = labels.get(key);
  if (cached !== undefined) return cached;
  const label = (year === new Date().getFullYear() ? dayFormatter : dayWithYearFormatter).format(date);
  if (labels.size > 500) labels.clear();
  labels.set(key, label);
  return label;
};

export const messageDayKey = (timestamp?: number) => {
  const date = toDate(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
