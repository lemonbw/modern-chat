const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const labels = new Map<string, string>();
const labelLimit = 2000;

const remember = (key: string, label: string) => {
  if (labels.size >= labelLimit) labels.clear();
  labels.set(key, label);
  return label;
};

export const formatTimeOfDay = (timestamp: number) => {
  const key = `t${timestamp}`;
  const cached = labels.get(key);
  if (cached !== undefined) return cached;
  return remember(key, timeFormatter.format(timestamp));
};

export const formatDateTime = (date: Date) => {
  const key = `d${date.getTime()}`;
  const cached = labels.get(key);
  if (cached !== undefined) return cached;
  return remember(key, dateTimeFormatter.format(date));
};