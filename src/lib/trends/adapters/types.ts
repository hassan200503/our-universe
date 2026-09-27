import type { TrendExtra } from "@/lib/db/schema";

/** What every adapter returns, before categorisation and storage. */
export type NormalizedItem = {
  title: string;
  summary: string | null;
  author: string | null;
  url: string;
  publishedAt: Date;
  sourceUpdatedAt: Date | null;
  imageUrl: string | null;
  imageCredit: string | null;
  imageLicense: string | null;
  contentType: "article" | "paper" | "essay" | "encyclopedia" | "observation";
  extra: TrendExtra | null;
  /** Extra text that category rules may match on but that isn't displayed. */
  ruleHints?: string;
};

export type FetchState = { etag: string | null; lastModified: string | null };

export type AdapterResult =
  | { status: "not-modified" }
  | { status: "ok"; items: NormalizedItem[]; etag: string | null; lastModified: string | null };

export class SourceError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    /** Seconds the source asked us to wait (Retry-After). */
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export const USER_AGENT = "OurUniverse/1.0 (personal discovery feed; respects robots and rate limits)";

/** fetch with a timeout, conditional-GET headers and typed errors. */
export async function fetchSource(url: string, state: FetchState, accept: string): Promise<Response | "not-modified"> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: accept };
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000), cache: "no-store", redirect: "follow" });
  } catch (e) {
    throw new SourceError(e instanceof Error && e.name === "TimeoutError" ? "Timed out after 15s" : `Network error: ${String(e)}`);
  }
  if (res.status === 304) return "not-modified";
  if (!res.ok) {
    const ra = Number(res.headers.get("retry-after"));
    throw new SourceError(`HTTP ${res.status}`, res.status, Number.isFinite(ra) && ra > 0 ? ra : undefined);
  }
  return res;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A short, attributable excerpt: we never store full articles. Cuts at a
 * sentence or word boundary under `max` characters.
 */
export function excerpt(text: string | null | undefined, max = 280): string | null {
  if (!text) return null;
  const clean = stripHtml(text)
    .replace(/The post .* appeared first on .*$/i, "")
    .replace(/Continue reading.*$/i, "")
    .trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
}
