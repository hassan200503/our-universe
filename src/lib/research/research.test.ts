import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { citeNumber, withCitations } from "./cite";
import { showable, splitFollowUps } from "./server";
import { rebuildAbstract, searchTerms, toStudy } from "./studies";
import { suggestionsFor } from "./suggest";
import { seal, unseal } from "@/lib/settings";
import { fetchRelay } from "@/lib/calls/ice";

describe("follow-up questions", () => {
  it("splits the trailing FOLLOW-UPS line off an answer, tolerating Markdown around it", () => {
    const text = "Sleep matters [1].\n\n## Key findings\n- More is better.\n\n**FOLLOW-UPS:** How much sleep do adults need? | Does napping count? | “What about caffeine?”";
    const { body, followUps } = splitFollowUps(text);
    expect(body).toBe("Sleep matters [1].\n\n## Key findings\n- More is better.");
    expect(followUps).toEqual(["How much sleep do adults need?", "Does napping count?", "What about caffeine?"]);
  });

  it("reads follow-ups listed on their own lines too", () => {
    const { body, followUps } = splitFollowUps("Answer.\n\nFOLLOW-UPS:\n1. First one?\n2. Second one?\n- Third one?");
    expect(body).toBe("Answer.");
    expect(followUps).toEqual(["First one?", "Second one?", "Third one?"]);
  });

  it("leaves answers without the line untouched", () => {
    expect(splitFollowUps("  Just an answer.  ")).toEqual({ body: "Just an answer.", followUps: [] });
  });

  it("never shows the follow-up line while an answer streams, even half-written", () => {
    const answer = "Line one.\nLine two.\n";
    expect(showable(answer)).toBe(answer);
    expect(showable(`${answer}FOLL`)).toBe(answer);
    expect(showable(`${answer}**FOLLOW-UP`)).toBe(answer);
    expect(showable(`${answer}FOLLOW-UPS: a | b`)).toBe(answer);
    // Ordinary text that merely starts like it is shown as soon as it can't be the marker.
    expect(showable(`${answer}Follow the evidence`)).toBe(`${answer}Follow the evidence`);
    expect(showable(`${answer}The next`)).toBe(`${answer}The next`);
  });
});

describe("citations", () => {
  it("turns [n], [n, m], [n–m] and [n][m] into study links, leaving real links alone", () => {
    expect(withCitations("Shown [1].")).toBe("Shown [1](#cite-1).");
    expect(withCitations("Shown [1, 3].")).toBe("Shown [1](#cite-1)[3](#cite-3).");
    expect(withCitations("Shown [2–4].")).toBe("Shown [2](#cite-2)[3](#cite-3)[4](#cite-4).");
    expect(withCitations("Shown [1][2].")).toBe("Shown [1](#cite-1)[2](#cite-2).");
    expect(withCitations("See [3](https://x.org).")).toBe("See [3](https://x.org).");
    expect(withCitations("[1]: https://x.org")).toBe("[1]: https://x.org");
    expect(withCitations("As [1]: proven")).toBe("As [1](#cite-1): proven");
    expect(withCitations("A [2-40] range is not a citation")).toBe("A [2-40] range is not a citation");
  });

  it("reads citation links back", () => {
    expect(citeNumber("#cite-4")).toBe(4);
    expect(citeNumber("https://x.org")).toBeNull();
    expect(citeNumber(undefined)).toBeNull();
  });
});

describe("studies", () => {
  it("rebuilds OpenAlex abstracts in word order and trims long ones at a word", () => {
    expect(rebuildAbstract({ sleep: [1], Good: [0], matters: [2], sleep_: [] })).toBe("Good sleep matters");
    const long = rebuildAbstract(Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`word${i}`, [i]])), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
    expect(rebuildAbstract(null)).toBe("");
  });

  it("maps a work to a citable study, preferring the DOI link", () => {
    const s = toStudy(
      {
        id: "https://openalex.org/W1",
        title: "Sleep and <i>memory</i>",
        publication_year: 2024,
        doi: "https://doi.org/10.1/abc",
        cited_by_count: 12,
        authorships: [{ author: { display_name: "A" } }, { author: { display_name: "B" } }, { author: { display_name: "C" } }, { author: { display_name: "D" } }],
        primary_location: { source: { display_name: "Nature" } },
        abstract_inverted_index: { Hello: [0] },
      },
      1,
    );
    expect(s).toMatchObject({ n: 1, title: "Sleep and memory", year: 2024, authors: "A, B, C et al.", venue: "Nature", url: "https://doi.org/10.1/abc", doi: "10.1/abc", citations: 12 });
    expect(toStudy({ id: "x", title: "" }, 1)).toBeNull();
  });

  it("searches on the substance of a question", () => {
    expect(searchTerms("What does the latest research say about knitting and anxiety?")).toBe("knitting anxiety");
  });
});

describe("suggestions", () => {
  it("offers every mode, stays stable for a day and changes with the seed", () => {
    const a = suggestionsFor(["birds", "biotech"], "whitney|2026-09-29");
    expect(a).toHaveLength(6);
    expect(new Set(a.map((s) => s.mode))).toEqual(new Set(["research", "learn", "explain"]));
    expect(suggestionsFor(["birds", "biotech"], "whitney|2026-09-29")).toEqual(a);
    expect(new Set(a.map((s) => s.q)).size).toBe(6);
  });
});

describe("sealed settings", () => {
  it("round-trips a secret and rejects tampering", () => {
    const sealed = seal({ provider: "metered", apiKey: "k" });
    expect(sealed).not.toContain("metered");
    expect(unseal(sealed)).toEqual({ provider: "metered", apiKey: "k" });
    const [iv, tag, body] = sealed.split(".");
    expect(unseal(`${iv}.${tag}.${body.slice(0, -2)}AA`)).toBeNull();
    expect(unseal("nonsense")).toBeNull();
  });
});

describe("call relay providers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps only relay servers from Metered", async () => {
    const fetchMock = vi.fn(async () => Response.json([{ urls: "stun:stun.relay.metered.ca:80" }, { urls: "turn:global.relay.metered.ca:80", username: "u", credential: "c" }]));
    vi.stubGlobal("fetch", fetchMock);
    const servers = await fetchRelay({ provider: "metered", domain: "https://us.metered.live/", apiKey: "key" });
    expect(servers).toEqual([{ urls: "turn:global.relay.metered.ca:80", username: "u", credential: "c" }]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://us.metered.live/api/v1/turn/credentials?apiKey=key");
  });

  it("asks Cloudflare for credentials and explains a refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }, { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" }] })),
    );
    expect(await fetchRelay({ provider: "cloudflare", keyId: "id", token: "t" })).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(fetchRelay({ provider: "cloudflare", keyId: "id", token: "bad" })).rejects.toThrow(/refused/);
  });
});
