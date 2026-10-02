const dayFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dayWithYearFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

const toDate = (timestamp?: number) => (timestamp ? new Date(timestamp * 1000) : new Date());

/** Recent days read as "2 Oct", anything from a previous year keeps the year: "2 Oct 2024". */
export const messageDateLabel = (timestamp?: number) => {
  const date = toDate(timestamp);
  return (date.getFullYear() === new Date().getFullYear() ? dayFormatter : dayWithYearFormatter).format(date);
};

export const messageDayKey = (timestamp?: number) => {
  const date = toDate(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
