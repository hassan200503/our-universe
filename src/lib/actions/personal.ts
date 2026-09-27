"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { interests, knowledgeEntries, learningRecords, people, preferences, projects, radarItems, radarLanes, skills } from "@/lib/db/schema";
import { requireCtx } from "@/lib/context";
import { isTopicKey } from "@/lib/trends/topics";
import { type ActionState, firstError, formObject, isoDate, list, optText, optUrl, reqText, today, visibilityField } from "./util";

/** Every mutation here writes only rows owned by the signed-in person. */
async function me() {
  const ctx = await requireCtx();
  return { ctx, db: await getDb(), personId: ctx.me.id, slug: ctx.me.slug };
}

const world = (slug: string, sub = "") => revalidatePath(`/world/${slug}${sub}`);

// ─── Learning journal (Engineering Journey / Biotechnology Journey) ──────

const record = z.object({
  kind: reqText(40),
  title: reqText(200),
  description: optText(5000),
  occurredOn: isoDate,
  category: optText(80),
  technology: optText(120),
  difficulty: z.enum(["gentle", "moderate", "hard", "brutal"]).optional(),
  status: z.enum(["idea", "in-progress", "done", "parked"]).default("in-progress"),
  tags: optText(400),
  source: optText(300),
  notes: optText(5000),
  projectId: z.uuid().optional(),
  visibility: visibilityField,
});

export async function saveLearningRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const raw = formObject(fd);
  const parsed = record.safeParse({ occurredOn: today(), ...raw });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const values = { ...parsed.data, tags: list(parsed.data.tags, true), projectId: parsed.data.projectId ?? null, updatedAt: new Date() };
  if (values.projectId) {
    const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, values.projectId), eq(projects.personId, personId)));
    if (!p) return { error: "Unknown project" };
  }
  if (raw.id) {
    await db.update(learningRecords).set(values).where(and(eq(learningRecords.id, raw.id), eq(learningRecords.personId, personId)));
  } else {
    await db.insert(learningRecords).values({ ...values, personId });
  }
  world(slug, "/journal");
  world(slug);
  return { ok: true, message: raw.id ? "Updated" : "Added to your journey" };
}

export async function deleteLearningRecord(id: string) {
  const { db, personId, slug } = await me();
  await db.delete(learningRecords).where(and(eq(learningRecords.id, id), eq(learningRecords.personId, personId)));
  world(slug, "/journal");
}

// ─── Things I'm Building ──────────────────────────────────────────────────

const project = z.object({
  name: reqText(120),
  description: optText(2000),
  problem: optText(2000),
  stack: optText(500),
  architecture: optText(3000),
  status: z.enum(["idea", "building", "live", "paused", "archived"]).default("building"),
  screenshots: optText(3000),
  repoUrl: optUrl,
  liveUrl: optUrl,
  lessons: optText(5000),
  improvements: optText(5000),
  startedOn: isoDate.optional(),
  current: z.enum(["on"]).optional(),
  visibility: visibilityField,
});

export async function saveProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const raw = formObject(fd);
  const parsed = project.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const shots = list(parsed.data.screenshots);
  if (shots.some((s) => !/^https?:\/\//i.test(s))) return { error: "Screenshots must be image links (https://…)" };
  const values = { ...parsed.data, stack: list(parsed.data.stack), screenshots: shots, current: parsed.data.current === "on", updatedAt: new Date() };
  if (values.current) await db.update(projects).set({ current: false }).where(eq(projects.personId, personId));
  if (raw.id) await db.update(projects).set(values).where(and(eq(projects.id, raw.id), eq(projects.personId, personId)));
  else await db.insert(projects).values({ ...values, personId });
  world(slug, "/projects");
  world(slug);
  return { ok: true, message: "Project saved" };
}

export async function deleteProject(id: string) {
  const { db, personId, slug } = await me();
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.personId, personId)));
  world(slug, "/projects");
}

// ─── Knowledge Vault & Questions I'm Thinking About ──────────────────────

const entry = z.object({
  space: z.enum(["vault", "thinking"]),
  kind: reqText(40),
  title: reqText(300),
  body: optText(10000),
  source: optText(300),
  url: optUrl,
  tags: optText(400),
  visibility: visibilityField.default("private"),
});

export async function saveKnowledge(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const raw = formObject(fd);
  const parsed = entry.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const values = { ...parsed.data, tags: list(parsed.data.tags, true), updatedAt: new Date() };
  if (raw.id) await db.update(knowledgeEntries).set(values).where(and(eq(knowledgeEntries.id, raw.id), eq(knowledgeEntries.personId, personId)));
  else await db.insert(knowledgeEntries).values({ ...values, personId });
  world(slug, `/${parsed.data.space}`);
  return { ok: true, message: "Saved" };
}

export async function deleteKnowledge(id: string) {
  const { db, personId, slug } = await me();
  const [row] = await db.delete(knowledgeEntries).where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.personId, personId))).returning();
  if (row) world(slug, `/${row.space}`);
}

// ─── Radar ────────────────────────────────────────────────────────────────

async function ownLane(db: Awaited<ReturnType<typeof getDb>>, personId: string, laneId: string) {
  const [lane] = await db.select().from(radarLanes).where(and(eq(radarLanes.id, laneId), eq(radarLanes.personId, personId)));
  return lane ?? null;
}

export async function addRadarItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const parsed = z.object({ laneId: z.uuid(), name: reqText(120), note: optText(500) }).safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await ownLane(db, personId, parsed.data.laneId))) return { error: "Unknown lane" };
  await db.insert(radarItems).values({ ...parsed.data, personId });
  world(slug, "/radar");
  return { ok: true };
}

export async function moveRadarItem(itemId: string, laneId: string) {
  const { db, personId, slug } = await me();
  if (!(await ownLane(db, personId, laneId))) return;
  await db.update(radarItems).set({ laneId, updatedAt: new Date() }).where(and(eq(radarItems.id, itemId), eq(radarItems.personId, personId)));
  world(slug, "/radar");
}

export async function deleteRadarItem(itemId: string) {
  const { db, personId, slug } = await me();
  await db.delete(radarItems).where(and(eq(radarItems.id, itemId), eq(radarItems.personId, personId)));
  world(slug, "/radar");
}

export async function addRadarLane(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const parsed = z.object({ name: reqText(40) }).safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const [{ v }] = await db.select({ v: max(radarLanes.position) }).from(radarLanes).where(eq(radarLanes.personId, personId));
  await db.insert(radarLanes).values({ personId, name: parsed.data.name, position: (v ?? 0) + 1 });
  world(slug, "/radar");
  return { ok: true };
}

export async function renameRadarLane(laneId: string, name: string) {
  const { db, personId, slug } = await me();
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  await db.update(radarLanes).set({ name: clean }).where(and(eq(radarLanes.id, laneId), eq(radarLanes.personId, personId)));
  world(slug, "/radar");
}

/** Deleting a lane is refused while it still holds items, so nothing disappears by accident. */
export async function deleteRadarLane(laneId: string): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const items = await db.select({ id: radarItems.id }).from(radarItems).where(eq(radarItems.laneId, laneId)).limit(1);
  if (items.length) return { error: "Move its items out first" };
  await db.delete(radarLanes).where(and(eq(radarLanes.id, laneId), eq(radarLanes.personId, personId)));
  world(slug, "/radar");
  return { ok: true };
}

// ─── Skills ───────────────────────────────────────────────────────────────

const skill = z.object({
  name: reqText(120),
  category: reqText(60),
  level: z.coerce.number().int().min(1).max(5),
  evidence: optText(1000),
  visibility: visibilityField,
});

export async function saveSkill(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const raw = formObject(fd);
  const parsed = skill.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (raw.id) await db.update(skills).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(skills.id, raw.id), eq(skills.personId, personId)));
  else {
    const [{ v }] = await db.select({ v: max(skills.position) }).from(skills).where(eq(skills.personId, personId));
    await db.insert(skills).values({ ...parsed.data, personId, position: (v ?? 0) + 1 });
  }
  world(slug, "/skills");
  return { ok: true, message: "Skill saved" };
}

export async function deleteSkill(id: string) {
  const { db, personId, slug } = await me();
  await db.delete(skills).where(and(eq(skills.id, id), eq(skills.personId, personId)));
  world(slug, "/skills");
}

// ─── Profile, interests, preferences ─────────────────────────────────────

const profile = z.object({
  displayName: reqText(80),
  nickname: optText(40),
  headline: optText(120),
  course: optText(120),
  focus: optText(120),
  intro: optText(3000),
  motto: optText(200),
  publicProfile: z.enum(["on"]).optional(),
});

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId, slug } = await me();
  const parsed = profile.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  await db
    .update(people)
    .set({
      displayName: d.displayName,
      nickname: d.nickname ?? null,
      headline: d.headline ?? null,
      course: d.course ?? null,
      focus: d.focus ?? null,
      intro: d.intro ?? null,
      motto: d.motto ?? null,
      publicProfile: d.publicProfile === "on",
    })
    .where(eq(people.id, personId));
  revalidatePath("/", "layout");
  world(slug);
  return { ok: true, message: "Profile saved" };
}

export async function saveInterests(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId } = await me();
  const chosen = fd.getAll("topic").map(String).filter(isTopicKey);
  if (!chosen.length) return { error: "Keep at least one interest" };
  await db.delete(interests).where(eq(interests.personId, personId));
  await db.insert(interests).values(chosen.map((topic, position) => ({ personId, topic, position })));
  revalidatePath("/", "layout");
  return { ok: true, message: "Interests updated" };
}

const prefs = z.object({
  favoriteTopics: z.array(z.string()).default([]),
  mutedSources: z.array(z.string()).default([]),
  savedSources: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string().max(80)).default([]),
  blockedKeywords: optText(500),
  digestFrequency: z.enum(["weekly", "monthly", "off"]).default("weekly"),
});

/** Personalisation is always reversible: this replaces the whole preference row. */
export async function savePreferences(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, personId } = await me();
  const parsed = prefs.safeParse({
    favoriteTopics: fd.getAll("favoriteTopics").map(String).filter(isTopicKey),
    mutedSources: fd.getAll("mutedSources").map(String),
    savedSources: fd.getAll("savedSources").map(String),
    blockedCategories: fd.getAll("blockedCategories").map(String),
    blockedKeywords: formObject(fd).blockedKeywords,
    digestFrequency: formObject(fd).digestFrequency,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const values = { ...parsed.data, blockedKeywords: list(parsed.data.blockedKeywords, true), updatedAt: new Date() };
  await db.insert(preferences).values({ personId, ...values }).onConflictDoUpdate({ target: preferences.personId, set: values });
  revalidatePath("/", "layout");
  return { ok: true, message: "Preferences saved" };
}
