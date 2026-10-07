const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ngnCompact = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 2,
});

export const formatNgn = (kobo: number) => ngn.format(kobo / 100);
export const formatNgnCompact = (kobo: number) => ngnCompact.format(kobo / 100);

/** "2026-09" -> "September 2026" */
export function formatMonth(month: string, style: "long" | "short" = "long") {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

/** Current month in Lagos time as "YYYY-MM". */
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}`;
}

/** The current month and the `count - 1` months before it, newest first. */
export function recentMonths(count: number, from = currentMonth()) {
  const [y, m] = from.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
