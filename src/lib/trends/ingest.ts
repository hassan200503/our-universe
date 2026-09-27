import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { trendSources, trends } from "@/lib/db/schema";
import { fetchINat } from "./adapters/inaturalist";
import { fetchRss } from "./adapters/rss";
import { type AdapterResult, type NormalizedItem, SourceError } from "./adapters/types";
import { SOURCES, type SourceDef } from "./sources";
import { TOPICS, type TopicKey, categorize, tagsFor } from "./topics";

/**
 * TrendSource → adapter → normalise → deduplicate → categorise → store.
 *
 * Each run only touches sources that are due. A source is claimed atomically
 * (next_fetch_at is pushed forward in the same UPDATE that checks it), so two
 * overlapping runs — the scheduled cron and a visitor-triggered refresh — never
 * fetch the same source twice.
 */

export type SourceRunResult = { key: string; ok: boolean; stored: number; skipped?: "not-modified"; error?: string };

const MAX_BACKOFF_MIN = 24 * 60;

/** Commerce and clickbait that established publications mix into their feeds. */
export const LOW_QUALITY = /(promo|discount|coupon) codes?|\d+% off|\bdeals?\b.*\b(today|week|sale)|best .* deals|prime day|black friday|gift guide|sponsored|you won'?t believe/i;

/** Normalised URL used for deduplication across feeds (e.g. ScienceDaily's overlapping categories). */
export function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|mc_|fbclid|gclid)/i.test(p)) u.searchParams.delete(p);
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    u.protocol = "https:";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function relevance(source: SourceDef, item: NormalizedItem, tags: string[]): number {
  const quality = (9 - source.tier) / 8; // tier 1 → 1.0, tier 8 → 0.125
  const substance = item.summary && item.summary.length > 120 ? 0.1 : 0;
  const bridge = tags.length > 1 ? 0.1 : 0;
  return Math.min(1, 0.6 * quality + 0.2 + substance + bridge);
}

async function runAdapter(source: SourceDef, state: { etag: string | null; lastModified: string | null }): Promise<AdapterResult> {
  return source.kind === "rss" ? fetchRss(source, state) : fetchINat(source);
}

async function ingestSource(source: SourceDef): Promise<SourceRunResult> {
  const db = await getDb();
  const now = new Date();

  // Claim: only proceed if this source is still due, and push it forward so a
  // concurrent run skips it. The lease is the source's normal interval.
  const claimed = await db
    .update(trendSources)
    .set({ nextFetchAt: new Date(now.getTime() + source.every * 60_000), lastAttemptAt: now })
    .where(and(eq(trendSources.key, source.key), lte(trendSources.nextFetchAt, now)))
    .returning();
  const state = claimed[0];
  if (!state) return { key: source.key, ok: true, stored: 0, skipped: "not-modified" };

  try {
    const result = await runAdapter(source, { etag: state.etag, lastModified: state.lastModified });
    if (result.status === "not-modified") {
      await db.update(trendSources).set({ lastSuccessAt: now, lastError: null, consecutiveFailures: 0 }).where(eq(trendSources.key, source.key));
      return { key: source.key, ok: true, stored: 0, skipped: "not-modified" };
    }

    // A feed can list the same article twice (Audubon does, once per author).
    const unique = [...new Map(result.items.filter((i) => !LOW_QUALITY.test(i.title)).map((i) => [dedupeKey(i.url), i])).values()];
    const rows = unique.map((item) => {
      const text = `${item.ruleHints ?? ""} ${item.title} ${item.summary ?? ""}`.trim();
      const tags = tagsFor(source.topic, `${item.title} ${item.summary ?? ""}`);
      return {
        sourceKey: source.key,
        topic: source.topic,
        category: categorize(source.topic, text),
        title: item.title.slice(0, 300),
        summary: item.summary,
        author: item.author,
        sourceName: source.name,
        sourceUrl: item.url,
        dedupeKey: dedupeKey(item.url),
        publishedAt: item.publishedAt,
        fetchedAt: now,
        sourceUpdatedAt: item.sourceUpdatedAt,
        imageUrl: item.imageUrl,
        imageCredit: item.imageCredit,
        imageLicense: item.imageLicense,
        tags,
        relevance: relevance(source, item, tags),
        contentType: item.contentType,
        extra: item.extra,
      };
    });

    let stored = 0;
    // Chunked so a 60-item feed doesn't become one oversized statement.
    for (let i = 0; i < rows.length; i += 25) {
      const inserted = await db
        .insert(trends)
        .values(rows.slice(i, i + 25))
        .onConflictDoUpdate({
          target: trends.dedupeKey,
          // Keep the original fetch time; refresh fields the publisher may have corrected.
          set: { title: sql`excluded.title`, summary: sql`excluded.summary`, sourceUpdatedAt: sql`excluded.source_updated_at` },
        })
        .returning({ inserted: sql<boolean>`xmax = 0` });
      stored += inserted.filter((r) => r.inserted).length;
    }

    await db
      .update(trendSources)
      .set({
        lastSuccessAt: now,
        lastError: null,
        consecutiveFailures: 0,
        etag: result.etag,
        lastModified: result.lastModified,
        itemsStored: sql`${trendSources.itemsStored} + ${stored}`,
      })
      .where(eq(trendSources.key, source.key));
    return { key: source.key, ok: true, stored };
  } catch (e) {
    // Database errors carry the whole statement; keep only the cause for the status page.
    const err = e instanceof SourceError ? e : new SourceError(e instanceof Error ? String((e.cause as Error | undefined)?.message ?? e.message).split("\n")[0] : String(e));
    const failures = state.consecutiveFailures + 1;
    // Exponential backoff, capped at a day; honour Retry-After when a source rate-limits us.
    let waitMin = Math.min(source.every * 2 ** Math.min(failures, 6), MAX_BACKOFF_MIN);
    if (err.retryAfter) waitMin = Math.max(waitMin, Math.ceil(err.retryAfter / 60));
    await db
      .update(trendSources)
      .set({ lastError: err.message.slice(0, 300), consecutiveFailures: failures, nextFetchAt: new Date(now.getTime() + waitMin * 60_000) })
      .where(eq(trendSources.key, source.key));
    return { key: source.key, ok: false, stored: 0, error: err.message };
  }
}

/** Make sure every registry source has a state row (new sources become due immediately). */
async function ensureSourceRows() {
  const db = await getDb();
  await db
    .insert(trendSources)
    .values(SOURCES.map((s) => ({ key: s.key })))
    .onConflictDoNothing();
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>, deadline = Infinity): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      // Stop taking new work past the deadline; unclaimed sources simply stay due for the next run.
      while (i < items.length && Date.now() < deadline) {
        const item = items[i++];
        out.push(await fn(item));
      }
    }),
  );
  return out;
}

export type IngestSummary = { ranAt: string; attempted: number; stored: number; failed: SourceRunResult[]; results: SourceRunResult[] };

/**
 * Fetch every due source. `force` makes all sources due first (used by the
 * first local run and by the operator, never by visitors).
 */
export async function runIngest(opts: { force?: boolean; topics?: string[]; budgetMs?: number } = {}): Promise<IngestSummary> {
  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : Infinity;
  await ensureSourceRows();
  const db = await getDb();
  if (opts.force) await db.update(trendSources).set({ nextFetchAt: new Date(0) });

  const due = await db.select().from(trendSources).where(lte(trendSources.nextFetchAt, new Date()));
  const dueKeys = new Set(due.map((d) => d.key));
  const sources = SOURCES.filter((s) => dueKeys.has(s.key) && (!opts.topics || opts.topics.includes(s.topic)));

  // iNaturalist sources run one after another to respect its 1 req/s guidance.
  const inat = sources.filter((s) => s.kind === "inaturalist");
  const rss = sources.filter((s) => s.kind === "rss");
  const [rssResults, inatResults] = await Promise.all([pool(rss, 6, ingestSource, deadline), pool(inat, 1, ingestSource, deadline)]);
  const results = [...rssResults, ...inatResults];

  return {
    ranAt: new Date().toISOString(),
    attempted: results.length,
    stored: results.reduce((n, r) => n + r.stored, 0),
    failed: results.filter((r) => !r.ok),
    results,
  };
}

/**
 * Re-applies the current category and tag rules to every stored item, so
 * editing topics.ts reshapes existing feeds too (`npm run retag`).
 */
export async function retagAll(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: trends.id, topic: trends.topic, title: trends.title, summary: trends.summary, contentType: trends.contentType })
    .from(trends);
  let changed = 0;
  for (const r of rows) {
    if (!(r.topic in TOPICS)) continue;
    if (LOW_QUALITY.test(r.title)) {
      await db.delete(trends).where(eq(trends.id, r.id));
      continue;
    }
    const topic = r.topic as TopicKey;
    const hint = r.contentType === "observation" ? "observation: " : "";
    const text = `${r.title} ${r.summary ?? ""}`;
    await db
      .update(trends)
      .set({ category: categorize(topic, `${hint}${text}`), tags: tagsFor(topic, text) })
      .where(eq(trends.id, r.id));
    changed++;
  }
  return changed;
}
