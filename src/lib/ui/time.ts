const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "2 hours ago", "yesterday", "just now". */
export function ago(iso: string | Date, now = Date.now()): string {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return "just now";
}

/** "Sep 27, 2026" */
export function day(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Nairobi" });
}

export function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Request time for server components (kept out of render bodies for the purity lint). */
export function nowMs(): number {
  return Date.now();
}
