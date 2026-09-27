import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db/client";
import { knowledgeEntries, learningRecords, memories, people, photos, projects, radarItems, radarLanes, savedDiscoveries, sharedLearning, skills, trends } from "@/lib/db/schema";
import { type Ctx, visibleTo } from "@/lib/context";

/**
 * Read models for the personal and shared areas. Every personal query takes the
 * viewer's context and applies the visibility rule: owners see everything,
 * partners see "shared" and "public", nobody else reaches these functions.
 */

export async function journal(ctx: Ctx, ownerId: string, opts: { q?: string; kind?: string; limit?: number } = {}) {
  const db = await getDb();
  const like = opts.q ? `%${opts.q}%` : null;
  return db
    .select()
    .from(learningRecords)
    .where(
      and(
        eq(learningRecords.personId, ownerId),
        inArray(learningRecords.visibility, visibleTo(ctx, ownerId)),
        opts.kind ? eq(learningRecords.kind, opts.kind) : undefined,
        like ? or(ilike(learningRecords.title, like), ilike(learningRecords.description, like), ilike(learningRecords.technology, like), sql`array_to_string(${learningRecords.tags}, ' ') ilike ${like}`) : undefined,
      ),
    )
    .orderBy(desc(learningRecords.occurredOn), desc(learningRecords.createdAt))
    .limit(opts.limit ?? 200);
}

export async function projectList(ctx: Ctx, ownerId: string) {
  const db = await getDb();
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.personId, ownerId), inArray(projects.visibility, visibleTo(ctx, ownerId))))
    .orderBy(desc(projects.current), desc(projects.updatedAt));
}

export async function skillList(ownerId: string, visibilities: ("private" | "shared" | "public")[]) {
  const db = await getDb();
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.personId, ownerId), inArray(skills.visibility, visibilities)))
    .orderBy(desc(skills.primary), asc(skills.position));
}

export async function knowledge(ctx: Ctx, ownerId: string, space: "vault" | "thinking", opts: { q?: string; tag?: string } = {}) {
  const db = await getDb();
  const like = opts.q ? `%${opts.q}%` : null;
  return db
    .select()
    .from(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.personId, ownerId),
        eq(knowledgeEntries.space, space),
        inArray(knowledgeEntries.visibility, visibleTo(ctx, ownerId)),
        like ? or(ilike(knowledgeEntries.title, like), ilike(knowledgeEntries.body, like), ilike(knowledgeEntries.source, like)) : undefined,
        opts.tag ? sql`${opts.tag} = any(${knowledgeEntries.tags})` : undefined,
      ),
    )
    .orderBy(desc(knowledgeEntries.createdAt))
    .limit(300);
}

export async function radar(ownerId: string) {
  const db = await getDb();
  const [lanes, items] = await Promise.all([
    db.select().from(radarLanes).where(eq(radarLanes.personId, ownerId)).orderBy(asc(radarLanes.position)),
    db.select().from(radarItems).where(eq(radarItems.personId, ownerId)).orderBy(desc(radarItems.updatedAt)),
  ]);
  return lanes.map((l) => ({ ...l, items: items.filter((i) => i.laneId === l.id) }));
}

export async function story(ctx: Ctx, opts: { kind?: string; limit?: number } = {}) {
  const db = await getDb();
  return db
    .select({ m: memories, by: people.displayName, bySlug: people.slug, byTheme: people.theme, sourceUrl: trends.sourceUrl, sourceName: trends.sourceName })
    .from(memories)
    .innerJoin(people, eq(people.id, memories.addedBy))
    .leftJoin(trends, eq(trends.id, memories.trendId))
    .where(and(eq(memories.relationshipId, ctx.relationship.id), opts.kind ? eq(memories.kind, opts.kind) : undefined))
    .orderBy(desc(memories.occurredOn), desc(memories.createdAt))
    .limit(opts.limit ?? 500);
}

export async function learningTogether(ctx: Ctx) {
  const db = await getDb();
  return db
    .select({ l: sharedLearning, by: people.displayName, byTheme: people.theme })
    .from(sharedLearning)
    .innerJoin(people, eq(people.id, sharedLearning.addedBy))
    .where(eq(sharedLearning.relationshipId, ctx.relationship.id))
    .orderBy(desc(sharedLearning.favorite), desc(sharedLearning.occurredOn), desc(sharedLearning.createdAt));
}

/** Counts for a person's dashboard. */
export async function personStats(ctx: Ctx, ownerId: string) {
  const db = await getDb();
  const vis = visibleTo(ctx, ownerId);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [[j], [j30], [p], [k], [s]] = await Promise.all([
    db.select({ n: count() }).from(learningRecords).where(and(eq(learningRecords.personId, ownerId), inArray(learningRecords.visibility, vis))),
    db.select({ n: count() }).from(learningRecords).where(and(eq(learningRecords.personId, ownerId), inArray(learningRecords.visibility, vis), gte(learningRecords.occurredOn, since))),
    db.select({ n: count() }).from(projects).where(and(eq(projects.personId, ownerId), inArray(projects.visibility, vis))),
    db.select({ n: count() }).from(knowledgeEntries).where(and(eq(knowledgeEntries.personId, ownerId), inArray(knowledgeEntries.visibility, vis))),
    db.select({ n: count() }).from(savedDiscoveries).where(eq(savedDiscoveries.personId, ownerId)),
  ]);
  return { journal: j.n, journal30: j30.n, projects: p.n, knowledge: k.n, saved: s.n };
}

/** A week (or any window) summarised: the data behind the weekly digest. */
export async function digest(ctx: Ctx, from: Date, to: Date) {
  const db = await getDb();
  const f = from.toISOString().slice(0, 10);
  const t = to.toISOString().slice(0, 10);
  const members = ctx.members.map((m) => m.id);
  const [mem, learn, saves, records] = await Promise.all([
    db.select().from(memories).where(and(eq(memories.relationshipId, ctx.relationship.id), gte(memories.createdAt, from), sql`${memories.createdAt} < ${to.toISOString()}::timestamptz`)),
    db.select().from(sharedLearning).where(and(eq(sharedLearning.relationshipId, ctx.relationship.id), gte(sharedLearning.createdAt, from), sql`${sharedLearning.createdAt} < ${to.toISOString()}::timestamptz`)),
    db
      .select({ personId: savedDiscoveries.personId, t: trends })
      .from(savedDiscoveries)
      .innerJoin(trends, eq(trends.id, savedDiscoveries.trendId))
      .where(and(inArray(savedDiscoveries.personId, members), gte(savedDiscoveries.createdAt, from), sql`${savedDiscoveries.createdAt} < ${to.toISOString()}::timestamptz`)),
    db
      .select()
      .from(learningRecords)
      .where(and(inArray(learningRecords.personId, members), gte(learningRecords.occurredOn, f), sql`${learningRecords.occurredOn} < ${t}::date`)),
  ]);
  // Private journal entries appear only in their owner's digest.
  const visibleRecords = records.filter((r) => (visibleTo(ctx, r.personId) as string[]).includes(r.visibility));
  const topByTopic = await db.execute<{ topic: string; id: string; title: string; source_name: string; source_url: string; published_at: string }>(sql`
    select distinct on (topic) topic, id, title, source_name, source_url, published_at
    from ${trends}
    where published_at >= ${from.toISOString()}::timestamptz and published_at < ${to.toISOString()}::timestamptz
    order by topic, relevance desc, published_at desc`);
  const rows = (topByTopic as unknown as { rows?: unknown[] }).rows ?? (topByTopic as unknown as unknown[]);
  return { memories: mem, learning: learn, saves, records: visibleRecords, highlights: rows as { topic: string; id: string; title: string; source_name: string; source_url: string; published_at: string }[] };
}

export type SearchHit = { kind: string; title: string; snippet: string | null; href: string; owner?: string; date?: string };

/** Global search. Personal rows are filtered by the same visibility rule as their pages. */
export async function searchAll(ctx: Ctx, q: string): Promise<SearchHit[]> {
  const db = await getDb();
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const members = ctx.members;
  const name = (id: string) => members.find((m) => m.id === id);
  const visFor = (table: { personId: PgColumn; visibility: PgColumn }) =>
    or(...members.map((m) => and(eq(table.personId, m.id), inArray(table.visibility, visibleTo(ctx, m.id)))));
  const memberIds = members.map((m) => m.id);

  const [mem, learn, recs, projs, sk, kn, found] = await Promise.all([
    db.select().from(memories).where(and(eq(memories.relationshipId, ctx.relationship.id), or(ilike(memories.title, like), ilike(memories.body, like), ilike(memories.place, like), ilike(memories.why, like)))).limit(20),
    db.select().from(sharedLearning).where(and(eq(sharedLearning.relationshipId, ctx.relationship.id), or(ilike(sharedLearning.title, like), ilike(sharedLearning.notes, like), ilike(sharedLearning.topic, like)))).limit(20),
    db.select().from(learningRecords).where(and(inArray(learningRecords.personId, memberIds), visFor(learningRecords), or(ilike(learningRecords.title, like), ilike(learningRecords.description, like), ilike(learningRecords.technology, like), ilike(learningRecords.notes, like), sql`array_to_string(${learningRecords.tags}, ' ') ilike ${like}`))).limit(20),
    db.select().from(projects).where(and(inArray(projects.personId, memberIds), visFor(projects), or(ilike(projects.name, like), ilike(projects.description, like), sql`array_to_string(${projects.stack}, ' ') ilike ${like}`))).limit(20),
    db.select().from(skills).where(and(inArray(skills.personId, memberIds), visFor(skills), or(ilike(skills.name, like), ilike(skills.category, like), ilike(skills.evidence, like)))).limit(20),
    db.select().from(knowledgeEntries).where(and(inArray(knowledgeEntries.personId, memberIds), visFor(knowledgeEntries), or(ilike(knowledgeEntries.title, like), ilike(knowledgeEntries.body, like), ilike(knowledgeEntries.source, like), sql`array_to_string(${knowledgeEntries.tags}, ' ') ilike ${like}`))).limit(20),
    db.select().from(trends).where(or(ilike(trends.title, like), ilike(trends.summary, like), sql`${trends.extra}->>'scientificName' ilike ${like}`)).orderBy(desc(trends.publishedAt)).limit(24),
  ]);

  const d = (v: string | Date) => (typeof v === "string" ? v : v.toISOString());
  return [
    ...mem.map((m) => ({ kind: m.kind === "plan" ? "Plan" : m.kind === "discovery" ? "Saved to Our Story" : "Memory", title: m.title, snippet: m.body ?? m.why, href: "/story", owner: name(m.addedBy)?.displayName, date: m.occurredOn })),
    ...learn.map((l) => ({ kind: "Things we are learning", title: l.title, snippet: l.notes, href: "/learning", owner: name(l.addedBy)?.displayName, date: l.occurredOn })),
    ...recs.map((r) => ({ kind: name(r.personId)?.journalTitle ?? "Journal", title: r.title, snippet: r.description, href: `/world/${name(r.personId)?.slug}/journal?q=${encodeURIComponent(q)}`, owner: name(r.personId)?.displayName, date: r.occurredOn })),
    ...projs.map((p) => ({ kind: "Project", title: p.name, snippet: p.description, href: `/world/${name(p.personId)?.slug}/projects`, owner: name(p.personId)?.displayName })),
    ...sk.map((s) => ({ kind: "Skill", title: s.name, snippet: s.evidence, href: `/world/${name(s.personId)?.slug}/skills`, owner: name(s.personId)?.displayName })),
    ...kn.map((k) => ({ kind: k.space === "thinking" ? "Thinking journal" : "Knowledge Vault", title: k.title, snippet: k.body, href: `/world/${name(k.personId)?.slug}/${k.space}?q=${encodeURIComponent(q)}`, owner: name(k.personId)?.displayName, date: d(k.createdAt) })),
    ...found.map((t) => ({ kind: `Discovery · ${t.sourceName}`, title: t.title, snippet: t.summary, href: `/discover/item/${t.id}`, date: d(t.publishedAt) })),
  ];
}

/** Memories from today's date in earlier years. */
export async function onThisDay(ctx: Ctx, today: Date) {
  const db = await getDb();
  const m = today.getUTCMonth() + 1;
  const d = today.getUTCDate();
  return db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.relationshipId, ctx.relationship.id),
        sql`extract(month from ${memories.occurredOn}) = ${m}`,
        sql`extract(day from ${memories.occurredOn}) = ${d}`,
        sql`extract(year from ${memories.occurredOn}) < ${today.getUTCFullYear()}`,
      ),
    )
    .orderBy(desc(memories.occurredOn));
}

export async function recentPhotos(ctx: Ctx, limit = 8) {
  const db = await getDb();
  return db
    .select({ id: photos.id, width: photos.width, height: photos.height, caption: photos.caption, createdAt: photos.createdAt })
    .from(photos)
    .where(eq(photos.relationshipId, ctx.relationship.id))
    .orderBy(desc(photos.createdAt))
    .limit(limit);
}

/** Days together and the next anniversary, from the relationship's start date. */
export function together(startedOn: string | null, now: Date) {
  if (!startedOn) return null;
  const start = new Date(`${startedOn}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.floor((today.getTime() - start.getTime()) / 86400_000);
  if (days < 0) return null;
  let next = new Date(Date.UTC(today.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
  const years = next.getUTCFullYear() - start.getUTCFullYear();
  return { days, years: Math.floor(days / 365.25), nextAnniversary: next.toISOString().slice(0, 10), nextYears: years, daysToAnniversary: Math.round((next.getTime() - today.getTime()) / 86400_000) };
}

/** Days until a birthday (0 = today) and the age being turned, in Nairobi time. */
export function birthdayInfo(birthday: string | null, now: Date) {
  if (!birthday) return null;
  const [y, m, d] = birthday.split("-").map(Number);
  const local = new Date(now.getTime() + 3 * 3600_000);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  let next = Date.UTC(local.getUTCFullYear(), m - 1, d);
  if (next < today) next = Date.UTC(local.getUTCFullYear() + 1, m - 1, d);
  return { days: Math.round((next - today) / 86400_000), turning: new Date(next).getUTCFullYear() - y, date: new Date(next).toISOString().slice(0, 10) };
}

/** Days until an ISO date (0 = today), or null if it has passed. */
export function daysUntil(isoDate: string | null, now: Date) {
  if (!isoDate) return null;
  const local = new Date(now.getTime() + 3 * 3600_000);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const d = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / 86400_000);
  return d >= 0 ? d : null;
}
