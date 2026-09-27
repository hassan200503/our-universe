import "server-only";
import { and, arrayOverlaps, desc, eq, gte, inArray, max, notInArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { interests, people, preferences, savedDiscoveries, trendSources, trends } from "@/lib/db/schema";
import { SOURCES } from "./sources";
import { LIFE_TAGS, MIND_TAGS, TOPICS, type TopicKey, isTopicKey } from "./topics";

/** The shape the browser receives. Dates are ISO strings. */
export type TrendCard = {
  id: string;
  title: string;
  summary: string | null;
  topic: TopicKey;
  category: string;
  sourceName: string;
  sourceUrl: string;
  author: string | null;
  publishedAt: string;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  imageLicense: string | null;
  tags: string[];
  contentType: string;
  extra: (typeof trends.$inferSelect)["extra"];
  /** Reactions by relationship members, keyed by person slug. */
  reactions: Record<string, string[]>;
};

export type FeedHealth = {
  degraded: boolean;
  failingSources: string[];
  lastRefreshedAt: string | null;
  newestPublishedAt: string | null;
};

export type FeedPage = { items: TrendCard[]; nextCursor: string | null; health?: FeedHealth };

type Pos = [string, string]; // [publishedAt ISO, id]

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function dec<T>(c: string | null | undefined): T | null {
  if (!c) return null;
  try {
    return JSON.parse(Buffer.from(c, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

const before = (p: Pos | null): SQL | undefined => (p ? sql`(${trends.publishedAt}, ${trends.id}) < (${new Date(p[0]).toISOString()}::timestamptz, ${p[1]}::uuid)` : undefined);

async function prefFilters(personId: string | null): Promise<SQL[]> {
  if (!personId) return [];
  const db = await getDb();
  const [p] = await db.select().from(preferences).where(eq(preferences.personId, personId));
  if (!p) return [];
  const out: SQL[] = [];
  if (p.mutedSources.length) out.push(notInArray(trends.sourceKey, p.mutedSources));
  if (p.blockedCategories.length) out.push(notInArray(trends.category, p.blockedCategories));
  for (const kw of p.blockedKeywords.slice(0, 20)) {
    const like = `%${kw.replace(/[%_\\]/g, "\\$&")}%`;
    out.push(sql`not (${trends.title} ilike ${like} or coalesce(${trends.summary}, '') ilike ${like})`);
  }
  return out;
}

async function attachReactions(rows: (typeof trends.$inferSelect)[]): Promise<TrendCard[]> {
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const saves = ids.length
    ? await db
        .select({ trendId: savedDiscoveries.trendId, kind: savedDiscoveries.kind, slug: people.slug })
        .from(savedDiscoveries)
        .innerJoin(people, eq(people.id, savedDiscoveries.personId))
        .where(inArray(savedDiscoveries.trendId, ids))
    : [];
  return rows.map((r) => {
    const reactions: Record<string, string[]> = {};
    for (const s of saves) if (s.trendId === r.id) (reactions[s.slug] ??= []).push(s.kind);
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      topic: r.topic as TopicKey,
      category: r.category,
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      author: r.author,
      publishedAt: r.publishedAt.toISOString(),
      fetchedAt: r.fetchedAt.toISOString(),
      sourceUpdatedAt: r.sourceUpdatedAt?.toISOString() ?? null,
      imageUrl: r.imageUrl,
      imageCredit: r.imageCredit,
      imageLicense: r.imageLicense,
      tags: r.tags,
      contentType: r.contentType,
      extra: r.extra,
      reactions,
    };
  });
}

export async function topicHealth(topics: TopicKey[]): Promise<FeedHealth> {
  const db = await getDb();
  const keys = SOURCES.filter((s) => topics.includes(s.topic)).map((s) => s.key);
  if (!keys.length) return { degraded: false, failingSources: [], lastRefreshedAt: null, newestPublishedAt: null };
  const [states, newest] = await Promise.all([
    db.select().from(trendSources).where(inArray(trendSources.key, keys)),
    db.select({ v: max(trends.publishedAt) }).from(trends).where(inArray(trends.topic, topics)),
  ]);
  const failing = states.filter((s) => s.consecutiveFailures > 0).map((s) => SOURCES.find((d) => d.key === s.key)?.name ?? s.key);
  const lastOk = states.map((s) => s.lastSuccessAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
  return {
    degraded: failing.length > 0,
    failingSources: [...new Set(failing)],
    lastRefreshedAt: lastOk ? new Date(lastOk).toISOString() : null,
    newestPublishedAt: newest[0]?.v ? new Date(newest[0].v).toISOString() : null,
  };
}

/** One topic's feed, optionally narrowed to a category. Keyset paginated on (published_at, id). */
export async function topicFeed(opts: { topic: TopicKey; category?: string | null; cursor?: string | null; limit?: number; personId?: string | null }): Promise<FeedPage> {
  const db = await getDb();
  const limit = Math.min(opts.limit ?? 12, 30);
  const where = and(
    eq(trends.topic, opts.topic),
    opts.category ? eq(trends.category, opts.category) : undefined,
    before(dec<Pos>(opts.cursor)),
    ...(await prefFilters(opts.personId ?? null)),
  );
  const rows = await db.select().from(trends).where(where).orderBy(desc(trends.publishedAt), desc(trends.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: await attachReactions(page),
    nextCursor: rows.length > limit && last ? enc([last.publishedAt.toISOString(), last.id]) : null,
    health: opts.cursor ? undefined : await topicHealth([opts.topic]),
  };
}

export async function personTopics(personId: string): Promise<TopicKey[]> {
  const db = await getDb();
  const rows = await db.select({ topic: interests.topic }).from(interests).where(eq(interests.personId, personId)).orderBy(interests.position);
  return rows.map((r) => r.topic).filter(isTopicKey);
}

/**
 * "For You": interleaves every topic the person follows so one busy source
 * can't drown the others. The cursor holds a position per topic, and
 * favourite topics get twice the share of each page.
 */
export async function forYouFeed(opts: { personId: string; cursor?: string | null; limit?: number }): Promise<FeedPage> {
  const db = await getDb();
  const topics = await personTopics(opts.personId);
  const [pref] = await db.select().from(preferences).where(eq(preferences.personId, opts.personId));
  const favs = new Set(pref?.favoriteTopics ?? []);
  const cursor = dec<Record<string, Pos | "done">>(opts.cursor) ?? {};
  const active = topics.filter((t) => cursor[t] !== "done");
  if (!active.length) return { items: [], nextCursor: null };

  const limit = opts.limit ?? 12;
  const weightTotal = active.reduce((n, t) => n + (favs.has(t) ? 2 : 1), 0);
  const filters = await prefFilters(opts.personId);

  const next: Record<string, Pos | "done"> = { ...cursor };
  const picked: (typeof trends.$inferSelect)[] = [];
  await Promise.all(
    active.map(async (t) => {
      const share = Math.max(2, Math.round((limit * (favs.has(t) ? 2 : 1)) / weightTotal));
      const pos = cursor[t] as Pos | undefined;
      const rows = await db
        .select()
        .from(trends)
        .where(and(eq(trends.topic, t), before(pos ?? null), ...filters))
        .orderBy(desc(trends.publishedAt), desc(trends.id))
        .limit(share + 1);
      const take = rows.slice(0, share);
      picked.push(...take);
      const last = take.at(-1);
      next[t] = rows.length > share && last ? [last.publishedAt.toISOString(), last.id] : "done";
    }),
  );

  // Interleave by topic (round-robin) rather than pure recency, so the page reads as a mix.
  const byTopic = new Map<string, typeof picked>();
  for (const r of picked.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
    if (!byTopic.has(r.topic)) byTopic.set(r.topic, []);
    byTopic.get(r.topic)!.push(r);
  }
  const mixed: typeof picked = [];
  while ([...byTopic.values()].some((l) => l.length)) for (const l of byTopic.values()) if (l.length) mixed.push(l.shift()!);

  const done = topics.every((t) => next[t] === "done");
  return {
    items: await attachReactions(mixed),
    nextCursor: done ? null : enc(next),
    health: opts.cursor ? undefined : await topicHealth(topics),
  };
}

/**
 * "Something We Both Might Like": items that carry both a technology-family
 * tag (AI, software, computing, philosophy) and a life-family tag (biology,
 * birds, wildlife, climate) — the overlap between the two worlds.
 */
export async function bridgeFeed(opts: { cursor?: string | null; limit?: number; personId?: string | null }): Promise<FeedPage> {
  const db = await getDb();
  const limit = Math.min(opts.limit ?? 12, 30);
  const rows = await db
    .select()
    .from(trends)
    .where(and(arrayOverlaps(trends.tags, MIND_TAGS), arrayOverlaps(trends.tags, LIFE_TAGS), before(dec<Pos>(opts.cursor)), ...(await prefFilters(opts.personId ?? null))))
    .orderBy(desc(trends.publishedAt), desc(trends.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: await attachReactions(page),
    nextCursor: rows.length > limit && last ? enc([last.publishedAt.toISOString(), last.id]) : null,
    health: opts.cursor ? undefined : await topicHealth(Object.keys(TOPICS) as TopicKey[]),
  };
}

/** A person's saved / favourited / bookmarked discoveries, newest save first. */
export async function savedFeed(opts: { personId: string; kind?: string | null; cursor?: string | null; limit?: number }): Promise<FeedPage> {
  const db = await getDb();
  const limit = Math.min(opts.limit ?? 12, 30);
  const c = dec<[string, string]>(opts.cursor);
  const savedAt = sql<Date>`max(${savedDiscoveries.createdAt})`;
  // Grouped per trend: an item that is both saved and favourited appears once.
  const rows = await db
    .select({ t: trends, savedAt })
    .from(savedDiscoveries)
    .innerJoin(trends, eq(trends.id, savedDiscoveries.trendId))
    .where(and(eq(savedDiscoveries.personId, opts.personId), opts.kind ? eq(savedDiscoveries.kind, opts.kind) : undefined))
    .groupBy(trends.id)
    .having(c ? sql`(max(${savedDiscoveries.createdAt}), ${trends.id}) < (${c[0]}::timestamptz, ${c[1]}::uuid)` : undefined)
    .orderBy(desc(savedAt), desc(trends.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: await attachReactions(page.map((r) => r.t)),
    nextCursor: rows.length > limit && last ? enc([new Date(last.savedAt).toISOString(), last.t.id]) : null,
  };
}

/** Deterministic daily pick: the same all day, different tomorrow, always from real stored items. */
function dayHash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export async function todaysDiscovery(opts: { topics: TopicKey[]; seed: string; bridge?: boolean }): Promise<TrendCard | null> {
  if (!opts.topics.length && !opts.bridge) return null;
  const db = await getDb();
  const since = new Date(Date.now() - 4 * 24 * 3600 * 1000);
  const rows = await db
    .select()
    .from(trends)
    .where(
      and(
        gte(trends.publishedAt, since),
        opts.bridge ? and(arrayOverlaps(trends.tags, MIND_TAGS), arrayOverlaps(trends.tags, LIFE_TAGS)) : inArray(trends.topic, opts.topics),
        gte(trends.relevance, 0.5),
      ),
    )
    .orderBy(desc(trends.relevance), desc(trends.publishedAt))
    .limit(24);
  if (!rows.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const pick = rows[dayHash(`${opts.seed}:${today}`) % rows.length];
  return (await attachReactions([pick]))[0];
}

export async function latestInTopic(topic: TopicKey): Promise<TrendCard | null> {
  const db = await getDb();
  const [row] = await db.select().from(trends).where(eq(trends.topic, topic)).orderBy(desc(trends.publishedAt)).limit(1);
  return row ? (await attachReactions([row]))[0] : null;
}

export async function getTrend(id: string): Promise<TrendCard | null> {
  const db = await getDb();
  const [row] = await db.select().from(trends).where(eq(trends.id, id));
  return row ? (await attachReactions([row]))[0] : null;
}

/** Time since any source was last attempted; drives the self-healing refresh when the cron is down. */
export async function staleness(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ v: max(trendSources.lastAttemptAt) }).from(trendSources);
  return row?.v ? Date.now() - new Date(row.v).getTime() : Number.POSITIVE_INFINITY;
}

/** A random stored item from a topic, for "Discover another". Never fetched live. */
export async function randomTrend(topic: TopicKey, exclude?: string | null): Promise<TrendCard | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trends)
    .where(and(eq(trends.topic, topic), topic === "birds" ? eq(trends.contentType, "observation") : undefined, exclude ? sql`${trends.id} <> ${exclude}::uuid` : undefined))
    .orderBy(sql`random()`)
    .limit(1);
  return row ? (await attachReactions([row]))[0] : null;
}
