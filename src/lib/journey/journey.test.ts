import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseVerse, pick, roman, VERSES, VOWS } from "./verses";
import { journeyParts } from "@/components/home/journey-clock";
import { dayLabel, duration, isEmojiOnly, lastSeen, linkify } from "@/components/chat/format";

describe("verse rotation", () => {
  it("never repeats any of the last dozen lines", () => {
    let memory: string | undefined;
    const shown: number[] = [];
    for (let i = 0; i < 400; i++) {
      const v = pick(VERSES, memory);
      expect(shown.slice(-12)).not.toContain(v.index);
      shown.push(v.index);
      memory = v.remember;
    }
    // Every line gets its turn.
    expect(new Set(shown).size).toBe(VERSES.length);
  });
  it("always changes from one visit to the next, even for the short list", () => {
    let memory: string | undefined;
    let last = -1;
    for (let i = 0; i < 200; i++) {
      const v = pick(VOWS, memory);
      expect(v.index).not.toBe(last);
      last = v.index;
      memory = v.remember;
    }
  });
  it("ignores a tampered or stale cookie", () => {
    const v = pick(VERSES, "999.-1.abc..3");
    expect(v.index).toBeGreaterThanOrEqual(0);
    expect(v.index).toBeLessThan(VERSES.length);
    expect(v.index).not.toBe(3);
  });
  it("marks the gold words and keeps every verse free of greetings", () => {
    expect(parseVerse("Two paths, *one road.*")).toEqual([
      { t: "Two paths, ", em: false },
      { t: "one road.", em: true },
    ]);
    for (const v of [...VERSES, ...VOWS]) {
      expect(v.split("*").length % 2).toBe(1); // balanced markers
      expect(v.toLowerCase()).not.toMatch(/\bjust us\b|welcome|hello|\bhi\b|good (morning|evening)|amosi|oyawore|misawa|nade/);
    }
  });
  it("numbers chapters", () => {
    expect([1, 3, 4, 9, 14, 40].map(roman)).toEqual(["I", "III", "IV", "IX", "XIV", "XL"]);
  });
});

describe("journey clock", () => {
  const at = (iso: string) => Date.parse(iso);
  it("counts calendar years, months and days in Nairobi time", () => {
    expect(journeyParts("2024-02-14", at("2026-09-29T07:30:05Z"))).toEqual({ y: 2, m: 7, d: 15, h: 10, min: 30, s: 5 });
  });
  it("rolls over at Nairobi midnight, not UTC midnight", () => {
    // 21:30 UTC on the 13th is already 00:30 on the 14th in Nairobi: exactly one year.
    expect(journeyParts("2024-02-14", at("2025-02-13T21:30:00Z"))).toMatchObject({ y: 1, m: 0, d: 0, h: 0, min: 30 });
  });
  it("borrows days from the previous month", () => {
    expect(journeyParts("2024-01-31", at("2024-03-01T09:00:00Z"))).toMatchObject({ y: 0, m: 1, d: 1 });
  });
});

describe("chat formatting", () => {
  it("shows emoji-only messages large, but not text with emoji", () => {
    expect(isEmojiOnly("❤️")).toBe(true);
    expect(isEmojiOnly("😂😂")).toBe(true);
    expect(isEmojiOnly("👩🏽‍❤️‍👨🏾")).toBe(true);
    expect(isEmojiOnly("love you ❤️")).toBe(false);
    expect(isEmojiOnly("1")).toBe(false);
  });
  it("turns links into links and leaves the rest alone", () => {
    expect(linkify("see https://example.com/a?b=1, then")).toEqual([{ t: "see " }, { t: "https://example.com/a?b=1", href: "https://example.com/a?b=1" }, { t: ", then" }]);
    expect(linkify("no links here")).toEqual([{ t: "no links here" }]);
  });
  it("formats call length and last seen", () => {
    expect(duration(65)).toBe("1:05");
    expect(duration(3725)).toBe("1:02:05");
    expect(duration(0)).toBe("");
    const now = new Date(2026, 8, 29, 15, 0);
    expect(dayLabel(new Date(2026, 8, 29, 9, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 8, 28, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(lastSeen(null)).toBe("offline");
    expect(lastSeen(new Date(2026, 8, 29, 9, 5).toISOString(), now)).toMatch(/^last seen today at /);
  });
});
