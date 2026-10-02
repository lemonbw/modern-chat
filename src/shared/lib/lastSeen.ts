const relativeLabels: Record<string, string> = {
  online: "Online now",
  recently: "Last seen recently",
  lastseenrecently: "Last seen recently",
  lastweek: "Last seen within a week",
  lastseenwithinweek: "Last seen within a week",
  lastmonth: "Last seen within a month",
  lastseenwithinmonth: "Last seen within a month",
  alongtimeago: "Last seen a long time ago",
  lastseenalongtimeago: "Last seen a long time ago",
};

/** GREEN-API returns either a relative word or a unix timestamp, depending on the endpoint. */
export const lastSeenLabel = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "" || value === 0) return "Last seen hidden";
  const known = relativeLabels[value.toString().toLowerCase().replace(/[\s_-]/g, "")];
  if (known) return known;
  const numericValue = Number(value);
  const date = new Date(Number.isFinite(numericValue) ? (numericValue < 100_000_000_000 ? numericValue * 1000 : numericValue) : value);
  if (Number.isNaN(date.getTime())) return "Online status hidden";
  return `Last seen ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
};