import "server-only";
import { randomInt } from "node:crypto";

/**
 * Lines about the road the two of you chose to walk together. The home page
 * shows a different one on every visit and won't repeat any of the last dozen
 * until the rest have had their turn. `*…*` marks the words set in gold italic.
 */
export const VERSES = [
  "We didn't stumble into forever. *We chose it* — and we keep choosing it.",
  "Every road ahead is ours to walk, *side by side, all the way.*",
  "Two paths became one road, *and we walk it together, always.*",
  "However long the journey, *we go the distance together.*",
  "Not for a season. Not for a while. *For every day that follows.*",
  "We promised the long road — *and every mile of it is ours.*",
  "Wherever this life leads, *we arrive there together.*",
  "The journey is long. *So is our forever.*",
  "One day at a time, *one lifetime together.*",
  "Hand in hand, step by step, *all the way to always.*",
  "We chose each other on purpose, *and we'd choose the same again, every time.*",
  "Distance is only a chapter. *Together is the whole story.*",
  "Every sunrise is one more step *on the road we chose together.*",
  "The best part of any journey *is who you walk it with.*",
  "Whatever the weather, *we walk this road as one.*",
  "We aren't waiting for forever. *We're already walking in it.*",
  "Two hearts, one direction: *forward, together.*",
  "What we're building takes a lifetime — *and we have one, together.*",
  "The road bends, the seasons turn, *and still we walk it side by side.*",
  "Every step we take is a promise *we keep renewing.*",
  "We started a journey *that was never meant to have a final page.*",
  "Love found us once. *Now we choose it every morning.*",
  "Side by side is the only way *we ever want to travel.*",
  "Some journeys end. *Ours only goes further.*",
  "Forever isn't a place we reach — *it's the way we walk.*",
  "We walk slowly, we walk far, *and we never walk alone.*",
  "Whatever tomorrow brings, *we'll meet it together.*",
  "The miles between us are temporary. *The road we share is not.*",
  "Every chapter, every mile, *every forever — together.*",
  "The journey we chose is long, *and that is exactly the point.*",
  "From the first step to the last, *it was always going to be the two of us.*",
  "Together isn't where we are. *It's who we've decided to be.*",
  "Our story only knows one direction: *onward, hand in hand.*",
  "Two worlds, one orbit, *bound together for good.*",
  "We made a choice once. *We honour it every single day.*",
  "No map for where we're going — *only each other, and that's enough.*",
  "Through every season still to come, *the same promise: you and me.*",
  "Every ordinary day together *is a step toward our extraordinary forever.*",
] as const;

/** Shorter lines for the close of the page. */
export const VOWS = [
  "Still choosing each other.",
  "All the way, together.",
  "Every mile, side by side.",
  "Onward, hand in hand.",
  "Forever is a direction, not a destination.",
  "The road goes on, and so do we.",
  "Two worlds. One journey. Always.",
  "Walking toward forever, one day at a time.",
  "Wherever the road goes, together.",
  "The long way, the only way, together.",
  "Chosen once. Chosen always.",
  "Our journey has no last page.",
] as const;

export const VERSE_COOKIE = "ou_verses";
export const VOW_COOKIE = "ou_vows";

/** Picks a line not seen recently. Returns it plus the updated memory of recent picks for the cookie. */
export function pick<T extends readonly string[]>(deck: T, recent: string | undefined): { index: number; text: T[number]; remember: string } {
  const memory = Math.min(12, deck.length - 1);
  const seen = (recent ?? "")
    .split(".")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n < deck.length)
    .slice(-memory);
  const pool = deck.map((_, i) => i).filter((i) => !seen.includes(i));
  const index = pool[randomInt(pool.length)];
  return { index, text: deck[index], remember: [...seen, index].slice(-memory).join(".") };
}

/** A random item (or null) — used for the memory that greets each visit. */
export function pickOne<T>(list: T[]): T | null {
  return list.length ? list[randomInt(list.length)] : null;
}

/** "*gold* plain" → [{ t: "gold", em: true }, { t: " plain" }] */
export function parseVerse(text: string): { t: string; em: boolean }[] {
  return text
    .split("*")
    .map((t, i) => ({ t, em: i % 2 === 1 }))
    .filter((p) => p.t);
}

export function roman(n: number): string {
  const map: [number, string][] = [
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out || "I";
}
