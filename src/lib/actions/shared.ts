"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { knowledgeEntries, memories, photos, savedDiscoveries, sharedLearning, trends } from "@/lib/db/schema";
import { requireCtx } from "@/lib/context";
import { type ActionState, firstError, formObject, isoDate, optText, optUrl, reqText, today } from "./util";

// ─── Reactions on discoveries ─────────────────────────────────────────────

const REACTIONS = ["save", "favorite", "bookmark"] as const;

/** Toggles ❤️ save / ⭐ favourite / 📌 bookmark. Returns the new state. */
export async function toggleReaction(trendId: string, kind: string): Promise<{ on: boolean }> {
  const ctx = await requireCtx();
  if (!REACTIONS.includes(kind as (typeof REACTIONS)[number])) throw new Error("Unknown reaction");
  if (!z.uuid().safeParse(trendId).success) throw new Error("Bad id");
  const db = await getDb();
  const where = and(eq(savedDiscoveries.personId, ctx.me.id), eq(savedDiscoveries.trendId, trendId), eq(savedDiscoveries.kind, kind));
  const [existing] = await db.select().from(savedDiscoveries).where(where);
  if (existing) {
    await db.delete(savedDiscoveries).where(where);
    return { on: false };
  }
  await db.insert(savedDiscoveries).values({ personId: ctx.me.id, trendId, kind }).onConflictDoNothing();
  return { on: true };
}

/** 💬 A personal note on a discovery (stored on the "save" reaction). */
export async function noteOnDiscovery(trendId: string, note: string): Promise<ActionState> {
  const ctx = await requireCtx();
  const db = await getDb();
  const clean = note.trim().slice(0, 2000);
  await db
    .insert(savedDiscoveries)
    .values({ personId: ctx.me.id, trendId, kind: "save", note: clean || null })
    .onConflictDoUpdate({ target: [savedDiscoveries.personId, savedDiscoveries.trendId, savedDiscoveries.kind], set: { note: clean || null } });
  return { ok: true, message: "Note saved" };
}

// ─── Save to Our Story ────────────────────────────────────────────────────

const toStory = z.object({ trendId: z.uuid(), why: optText(1000), note: optText(2000), occurredOn: isoDate });

/** Personal interest → shared discovery → relationship memory. */
export async function saveToStory(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCtx();
  const parsed = toStory.safeParse({ occurredOn: today(), ...formObject(fd) });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [t] = await db.select().from(trends).where(eq(trends.id, parsed.data.trendId));
  if (!t) return { error: "That discovery no longer exists" };
  await db.insert(memories).values({
    relationshipId: ctx.relationship.id,
    addedBy: ctx.me.id,
    kind: "discovery",
    title: t.title,
    body: parsed.data.note ?? null,
    why: parsed.data.why ?? null,
    occurredOn: parsed.data.occurredOn,
    photoUrl: t.imageUrl,
    trendId: t.id,
  });
  await db.insert(savedDiscoveries).values({ personId: ctx.me.id, trendId: t.id, kind: "save" }).onConflictDoNothing();
  revalidatePath("/story");
  return { ok: true, message: "Saved to Our Story ❤️" };
}

/** Keep a discovery in my private Knowledge Vault. */
export async function saveToVault(trendId: string): Promise<ActionState> {
  const ctx = await requireCtx();
  const db = await getDb();
  const [t] = await db.select().from(trends).where(eq(trends.id, trendId));
  if (!t) return { error: "Not found" };
  const [dupe] = await db
    .select({ id: knowledgeEntries.id })
    .from(knowledgeEntries)
    .where(and(eq(knowledgeEntries.personId, ctx.me.id), eq(knowledgeEntries.trendId, t.id)));
  if (dupe) return { ok: true, message: "Already in your vault" };
  await db.insert(knowledgeEntries).values({
    personId: ctx.me.id,
    space: "vault",
    kind: "article",
    title: t.title,
    body: t.summary,
    source: t.sourceName,
    url: t.sourceUrl,
    tags: t.tags.filter((x) => x !== t.topic).slice(0, 6),
    trendId: t.id,
    visibility: "private",
  });
  revalidatePath(`/world/${ctx.me.slug}/vault`);
  return { ok: true, message: "Added to your Knowledge Vault" };
}

// ─── Our Story ────────────────────────────────────────────────────────────

const memory = z.object({
  kind: z.enum(["memory", "milestone", "plan", "adventure"]).default("memory"),
  title: reqText(200),
  body: optText(5000),
  occurredOn: isoDate,
  place: optText(200),
  // An uploaded photo (/api/photos/<id>) or an external https link.
  photoUrl: z.union([z.string().regex(/^\/api\/photos\/[0-9a-f-]{36}$/i), optUrl]).optional(),
});

export async function addMemory(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCtx();
  const parsed = memory.safeParse({ occurredOn: today(), ...formObject(fd) });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db.insert(memories).values({ ...parsed.data, relationshipId: ctx.relationship.id, addedBy: ctx.me.id });
  revalidatePath("/story");
  revalidatePath("/");
  return { ok: true, message: parsed.data.kind === "plan" ? "Plan added" : "Memory kept ❤️" };
}

export async function togglePlanDone(id: string) {
  const ctx = await requireCtx();
  const db = await getDb();
  const [m] = await db.select().from(memories).where(and(eq(memories.id, id), eq(memories.relationshipId, ctx.relationship.id)));
  if (!m) return;
  await db.update(memories).set({ planDone: !m.planDone }).where(eq(memories.id, id));
  revalidatePath("/story");
}

export async function deleteMemory(id: string) {
  const ctx = await requireCtx();
  const db = await getDb();
  // Either partner can remove a shared memory, but only within their relationship.
  const [gone] = await db.delete(memories).where(and(eq(memories.id, id), eq(memories.relationshipId, ctx.relationship.id))).returning();
  // An uploaded photo belongs to its memory; remove it too so storage doesn't fill with orphans.
  const photoId = gone?.photoUrl?.match(/^\/api\/photos\/([0-9a-f-]{36})$/i)?.[1];
  if (photoId) await db.delete(photos).where(and(eq(photos.id, photoId), eq(photos.relationshipId, ctx.relationship.id)));
  revalidatePath("/story");
}

// ─── Things We Are Learning ───────────────────────────────────────────────

const learning = z.object({ title: reqText(200), topic: optText(80), notes: optText(3000), source: optText(200), url: optUrl, occurredOn: isoDate });

export async function addSharedLearning(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCtx();
  const parsed = learning.safeParse({ occurredOn: today(), ...formObject(fd) });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db.insert(sharedLearning).values({ ...parsed.data, relationshipId: ctx.relationship.id, addedBy: ctx.me.id });
  revalidatePath("/learning");
  return { ok: true, message: "Added to what we're learning" };
}

export async function toggleLearningFavorite(id: string) {
  const ctx = await requireCtx();
  const db = await getDb();
  const [row] = await db.select().from(sharedLearning).where(and(eq(sharedLearning.id, id), eq(sharedLearning.relationshipId, ctx.relationship.id)));
  if (!row) return;
  await db.update(sharedLearning).set({ favorite: !row.favorite }).where(eq(sharedLearning.id, id));
  revalidatePath("/learning");
}

export async function deleteSharedLearning(id: string) {
  const ctx = await requireCtx();
  const db = await getDb();
  await db.delete(sharedLearning).where(and(eq(sharedLearning.id, id), eq(sharedLearning.relationshipId, ctx.relationship.id)));
  revalidatePath("/learning");
}

