import "server-only";

/**
 * Real studies for a question, from OpenAlex (openalex.org): a free, open
 * index of 250M+ scholarly works, no key needed. Gemini is given these to
 * synthesise and cite as [1], [2]…, so research answers point at actual
 * papers (title, authors, year, journal, DOI) rather than a model's memory.
 */
const BASE = process.env.OPENALEX_BASE_URL || "https://api.openalex.org";
const MAILTO = "our-universe@users.noreply.github.com"; // OpenAlex's "polite pool": faster, more reliable

export type Study = { n: number; title: string; year: number | null; authors: string; venue: string | null; url: string; doi: string | null; citations: number; abstract: string };

type Work = {
  id: string;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  doi?: string | null;
  cited_by_count?: number;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
  open_access?: { oa_url?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
};

/** OpenAlex stores abstracts as word → positions; put the words back in order. */
export function rebuildAbstract(inv: Record<string, number[]> | null | undefined, max = 900): string {
  if (!inv) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) for (const p of positions) words[p] = word;
  const text = words.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s\S*$/, "")}…` : text;
}

export function toStudy(w: Work, n: number): Study | null {
  const title = (w.title ?? w.display_name ?? "").replace(/<[^>]+>/g, "").trim();
  if (!title) return null;
  const names = (w.authorships ?? []).map((a) => a.author?.display_name).filter((x): x is string => !!x);
  const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : null;
  return {
    n,
    title,
    year: w.publication_year ?? null,
    authors: names.length > 3 ? `${names.slice(0, 3).join(", ")} et al.` : names.join(", "),
    venue: w.primary_location?.source?.display_name ?? null,
    url: doi ? `https://doi.org/${doi}` : (w.open_access?.oa_url ?? w.primary_location?.landing_page_url ?? w.id),
    doi,
    citations: w.cited_by_count ?? 0,
    abstract: rebuildAbstract(w.abstract_inverted_index),
  };
}

async function search(query: string, filter: string, perPage: number): Promise<Work[]> {
  const select = "id,title,display_name,publication_year,doi,cited_by_count,authorships,primary_location,open_access,abstract_inverted_index";
  const url = `${BASE}/works?search=${encodeURIComponent(query)}&filter=${filter}&per-page=${perPage}&select=${select}&mailto=${MAILTO}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  return ((await res.json()) as { results?: Work[] }).results ?? [];
}

/** Questions read naturally; the index searches better on the substance. */
export function searchTerms(question: string): string {
  return question
    .replace(/[?!.]+/g, " ")
    .replace(/\b(what|whats|what's|does|do|did|is|are|was|were|the|a|an|about|research|studies|study|say|says|latest|recent|new|findings|evidence|tell|me|us|how|why|can|could|should|there|any|on|of|in|for|to|and|or)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** The most relevant work, plus the newest, without repeats. Empty (never throws) when OpenAlex can't be reached. */
export async function findStudies(question: string, limit = 6): Promise<Study[]> {
  const q = searchTerms(question) || question.slice(0, 200);
  const recentFrom = `${new Date().getUTCFullYear() - 3}-01-01`;
  try {
    const [relevant, recent] = await Promise.all([
      search(q, "has_abstract:true,type:article|review|preprint", 8),
      search(q, `has_abstract:true,type:article|review|preprint,from_publication_date:${recentFrom}`, 5),
    ]);
    const seen = new Set<string>();
    const merged: Work[] = [];
    // Interleave so both the landmark papers and the latest ones make the cut.
    for (let i = 0; i < Math.max(relevant.length, recent.length); i++) {
      for (const w of [relevant[i], recent[i]]) {
        if (w && !seen.has(w.id)) {
          seen.add(w.id);
          merged.push(w);
        }
      }
    }
    return merged
      .map((w, i) => toStudy(w, i + 1))
      .filter((s): s is Study => !!s && s.abstract.length > 80)
      .slice(0, limit)
      .map((s, i) => ({ ...s, n: i + 1 }));
  } catch {
    return [];
  }
}
