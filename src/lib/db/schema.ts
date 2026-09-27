import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  date,
  jsonb,
  uuid,
  primaryKey,
  uniqueIndex,
  index,
  real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Data model for "Our Universe".
 *
 * People are not hard-coded: every personal area hangs off `people.id`, and a
 * relationship joins any number of people. Hassan and Whitney are simply the
 * two rows the seed creates.
 */

export type Visibility = "private" | "shared" | "public";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const visibility = () => text("visibility").$type<Visibility>().notNull().default("shared");

// ─── People & relationship ────────────────────────────────────────────────

export const people = pgTable("people", {
  id: id(),
  /** URL slug, e.g. "hassan". Never a nickname. */
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  /** Optional, private-to-the-couple nickname. Never shown on public pages. */
  nickname: text("nickname"),
  headline: text("headline"),
  course: text("course"),
  focus: text("focus"),
  intro: text("intro"),
  motto: text("motto"),
  /** Visual identity key: "hassan" | "whitney" | any future theme. */
  theme: text("theme").notNull(),
  /** Label used for the person's learning journal, e.g. "Engineering Journey". */
  journalTitle: text("journal_title").notNull().default("Learning Journey"),
  radarTitle: text("radar_title").notNull().default("Radar"),
  /** Optional sections this person uses: "projects", "thinking". */
  features: text("features").array().notNull().default(sql`'{}'::text[]`),
  publicProfile: boolean("public_profile").notNull().default(false),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const relationships = pgTable("relationships", {
  id: id(),
  name: text("name").notNull(),
  startedOn: date("started_on"),
  createdAt: createdAt(),
});

export const relationshipMembers = pgTable(
  "relationship_members",
  {
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.relationshipId, t.personId] })],
);

// ─── Interests, skills, preferences ───────────────────────────────────────

export const interests = pgTable(
  "interests",
  {
    id: id(),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    /** Key into the topic registry (src/lib/trends/topics.ts). */
    topic: text("topic").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("interests_person_topic").on(t.personId, t.topic)],
);

export const skills = pgTable("skills", {
  id: id(),
  personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  /** Self-assessed 1–5, on the scale described in the UI. */
  level: integer("level").notNull(),
  evidence: text("evidence"),
  primary: boolean("primary").notNull().default(false),
  position: integer("position").notNull().default(0),
  visibility: visibility(),
  updatedAt: updatedAt(),
});

export const preferences = pgTable("preferences", {
  personId: uuid("person_id").primaryKey().references(() => people.id, { onDelete: "cascade" }),
  favoriteTopics: text("favorite_topics").array().notNull().default(sql`'{}'::text[]`),
  blockedCategories: text("blocked_categories").array().notNull().default(sql`'{}'::text[]`),
  blockedKeywords: text("blocked_keywords").array().notNull().default(sql`'{}'::text[]`),
  mutedSources: text("muted_sources").array().notNull().default(sql`'{}'::text[]`),
  savedSources: text("saved_sources").array().notNull().default(sql`'{}'::text[]`),
  digestFrequency: text("digest_frequency").notNull().default("weekly"),
  updatedAt: updatedAt(),
});

// ─── Personal knowledge ───────────────────────────────────────────────────

export const learningRecords = pgTable(
  "learning_records",
  {
    id: id(),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    occurredOn: date("occurred_on").notNull(),
    category: text("category"),
    technology: text("technology"),
    difficulty: text("difficulty"),
    status: text("status").notNull().default("in-progress"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    source: text("source"),
    notes: text("notes"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    visibility: visibility(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("learning_person_date").on(t.personId, t.occurredOn)],
);

export const projects = pgTable("projects", {
  id: id(),
  personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  problem: text("problem"),
  stack: text("stack").array().notNull().default(sql`'{}'::text[]`),
  architecture: text("architecture"),
  status: text("status").notNull().default("building"),
  screenshots: text("screenshots").array().notNull().default(sql`'{}'::text[]`),
  repoUrl: text("repo_url"),
  liveUrl: text("live_url"),
  lessons: text("lessons"),
  improvements: text("improvements"),
  startedOn: date("started_on"),
  current: boolean("current").notNull().default(false),
  visibility: visibility(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Knowledge Vault entries and the philosophy "Questions I'm Thinking About" journal. */
export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: id(),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    /** "vault" or "thinking". */
    space: text("space").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    source: text("source"),
    url: text("url"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    trendId: uuid("trend_id").references(() => trends.id, { onDelete: "set null" }),
    visibility: text("visibility").$type<Visibility>().notNull().default("private"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("knowledge_person_space").on(t.personId, t.space, t.createdAt)],
);

export const radarLanes = pgTable("radar_lanes", {
  id: id(),
  personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});

export const radarItems = pgTable("radar_items", {
  id: id(),
  personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  laneId: uuid("lane_id").notNull().references(() => radarLanes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  note: text("note"),
  updatedAt: updatedAt(),
});

// ─── Shared world ─────────────────────────────────────────────────────────

/** Our Story: memories, milestones, plans and saved discoveries. */
export const memories = pgTable(
  "memories",
  {
    id: id(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    addedBy: uuid("added_by").notNull().references(() => people.id),
    kind: text("kind").notNull().default("memory"),
    title: text("title").notNull(),
    body: text("body"),
    why: text("why"),
    occurredOn: date("occurred_on").notNull(),
    photoUrl: text("photo_url"),
    place: text("place"),
    planDone: boolean("plan_done").notNull().default(false),
    trendId: uuid("trend_id").references(() => trends.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("memories_rel_date").on(t.relationshipId, t.occurredOn)],
);

export const sharedLearning = pgTable("shared_learning", {
  id: id(),
  relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
  addedBy: uuid("added_by").notNull().references(() => people.id),
  title: text("title").notNull(),
  topic: text("topic"),
  notes: text("notes"),
  source: text("source"),
  url: text("url"),
  favorite: boolean("favorite").notNull().default(false),
  occurredOn: date("occurred_on").notNull(),
  createdAt: createdAt(),
});

// ─── Live Trends Engine ───────────────────────────────────────────────────

/** Runtime state for each source in the registry (src/lib/trends/sources.ts). */
export const trendSources = pgTable("trend_sources", {
  key: text("key").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  nextFetchAt: timestamp("next_fetch_at", { withTimezone: true }).notNull().defaultNow(),
  etag: text("etag"),
  lastModified: text("last_modified"),
  itemsStored: integer("items_stored").notNull().default(0),
});

export type TrendExtra = {
  observedOn?: string;
  scientificName?: string;
  commonName?: string;
  place?: string;
  conservationStatus?: string;
  conservationAuthority?: string;
  fact?: string;
  factSource?: string;
  factUrl?: string;
  observer?: string;
  iconicTaxon?: string;
};

export const trends = pgTable(
  "trends",
  {
    id: id(),
    sourceKey: text("source_key").notNull(),
    topic: text("topic").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    author: text("author"),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    /** Normalised URL / title hash used to drop duplicates across sources. */
    dedupeKey: text("dedupe_key").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    imageUrl: text("image_url"),
    imageCredit: text("image_credit"),
    imageLicense: text("image_license"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    relevance: real("relevance").notNull().default(0.5),
    contentType: text("content_type").notNull().default("article"),
    extra: jsonb("extra").$type<TrendExtra>(),
  },
  (t) => [
    uniqueIndex("trends_dedupe").on(t.dedupeKey),
    index("trends_topic_published").on(t.topic, t.publishedAt, t.id),
    index("trends_published").on(t.publishedAt, t.id),
  ],
);

/** Save / favourite / bookmark reactions, one row per person, trend and kind. */
export const savedDiscoveries = pgTable(
  "saved_discoveries",
  {
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    trendId: uuid("trend_id").notNull().references(() => trends.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.trendId, t.kind] })],
);

export type Person = typeof people.$inferSelect;
export type Trend = typeof trends.$inferSelect;
