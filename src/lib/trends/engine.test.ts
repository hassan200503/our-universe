import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { excerpt, stripHtml } from "./adapters/types";
import { dedupeKey, LOW_QUALITY } from "./ingest";
import { categorize, LIFE_TAGS, MIND_TAGS, tagsFor } from "./topics";
import { visibleTo, type Ctx } from "../context";

describe("dedupeKey", () => {
  it("treats tracking parameters, www, protocol and trailing slashes as the same article", () => {
    const a = dedupeKey("http://www.sciencedaily.com/releases/2026/09/x.htm?utm_source=feed&utm_medium=rss#top");
    const b = dedupeKey("https://sciencedaily.com/releases/2026/09/x.htm/");
    expect(a).toBe(b);
  });
  it("keeps meaningful query parameters", () => {
    expect(dedupeKey("https://a.org/p?id=1")).not.toBe(dedupeKey("https://a.org/p?id=2"));
  });
});

describe("excerpt", () => {
  it("never stores more than a short summary", () => {
    const long = "<p>" + "A sentence about genomes. ".repeat(60) + "</p>";
    const out = excerpt(long)!;
    expect(out.length).toBeLessThanOrEqual(281);
    expect(out).not.toContain("<");
  });
  it("drops WordPress boilerplate", () => {
    expect(excerpt("Great yarn news. The post Yarn appeared first on MDK.")).toBe("Great yarn news.");
  });
  it("decodes entities", () => {
    expect(stripHtml("Fish &amp; chips &#8217;n&#x27;")).toBe("Fish & chips ’n'");
  });
});

describe("categorisation", () => {
  it("assigns the first matching category and falls back per topic", () => {
    expect(categorize("software", "JDK 27 lands with a new JEP")).toBe("Java");
    expect(categorize("biotech", "CRISPR base editing fixes a mutation")).toBe("CRISPR & gene editing");
    expect(categorize("birds", "observation: Aves")).toBe("Fresh sightings");
    expect(categorize("birds", "sound: Aves")).toBe("Bird songs");
    expect(categorize("knitting", "video: How to cast on")).toBe("Video tutorials");
    expect(categorize("knitting", "community: My first sweater")).toBe("Community makes");
    expect(categorize("knitting", "A quiet afternoon")).toBe("Inspiration");
  });
  it("does not mistake a developer 'environment' for climate", () => {
    expect(tagsFor("software", "Docker sandboxes give a consistent environment")).not.toContain("climate");
  });
  it("marks AI-in-biology items as bridges between the two worlds", () => {
    const tags = tagsFor("biotech", "Machine learning designs new enzymes");
    expect(tags.some((t) => MIND_TAGS.includes(t))).toBe(true);
    expect(tags.some((t) => LIFE_TAGS.includes(t))).toBe(true);
  });
});

describe("low-quality filter", () => {
  it.each(["Birdfy Discount Codes: 15% Off Sitewide", "The Best Laptop Deals This Week", "Our Gift Guide for Knitters"])("drops %s", (t) => {
    expect(LOW_QUALITY.test(t)).toBe(true);
  });
  it.each(["How to deal with legacy code", "Scientists decode bird song", "AI is dominating Climate Week"])("keeps %s", (t) => {
    expect(LOW_QUALITY.test(t)).toBe(false);
  });
});

describe("visibility", () => {
  const ctx = { me: { id: "hassan" } } as unknown as Ctx;
  it("lets owners see everything", () => {
    expect(visibleTo(ctx, "hassan")).toEqual(["private", "shared", "public"]);
  });
  it("never shows a partner private entries", () => {
    expect(visibleTo(ctx, "whitney")).not.toContain("private");
  });
});
