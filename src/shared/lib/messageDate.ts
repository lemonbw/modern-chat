const dayFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dayWithYearFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

const toDate = (timestamp?: number) => (timestamp ? new Date(timestamp * 1000) : new Date());

export const messageDateLabel = (timestamp?: number) => {
  const date = toDate(timestamp);
  return (date.getFullYear() === new Date().getFullYear() ? dayFormatter : dayWithYearFormatter).format(date);
};

export const messageDayKey = (timestamp?: number) => {
  const date = toDate(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
