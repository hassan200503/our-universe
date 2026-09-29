/** Small formatting helpers for the chat. */

export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today", "Yesterday", "Thursday", or "12 September 2026". */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

/** "last seen today at 14:02", "last seen yesterday at 21:10", "last seen 12 Sep at 09:00". */
export function lastSeen(iso: string | null, now = new Date()): string {
  if (!iso) return "offline";
  const d = new Date(iso);
  const label = dayLabel(iso, now);
  const when = label === "Today" ? "today" : label === "Yesterday" ? "yesterday" : d.toLocaleDateString([], { day: "numeric", month: "short" });
  return `last seen ${when} at ${clock(iso)}`;
}

export const duration = (s: number | null | undefined) => {
  if (!s || s < 1) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
/** One to three emoji on their own are shown large, like other messengers do. */
export const isEmojiOnly = (s: string) => s.length <= 24 && EMOJI_ONLY.test(s.trim());

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
/** Splits text into plain runs and links. */
export function linkify(text: string): { t: string; href?: string }[] {
  const out: { t: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index! > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[0], href: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
