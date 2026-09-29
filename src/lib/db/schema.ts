import {
  pgTable,
  bigserial,
  bigint,
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
  /** Storage pathname of the profile picture (see src/lib/media/storage.ts). */
  avatarPath: text("avatar_path"),
  birthday: date("birthday"),
  /** When this person last opened the gallery: drives the "new" badge. */
  gallerySeenAt: timestamp("gallery_seen_at", { withTimezone: true }),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const relationships = pgTable("relationships", {
  id: id(),
  name: text("name").notNull(),
  startedOn: date("started_on"),
  /** The next time they will be together in person: the countdown on the home page. */
  nextMeetOn: date("next_meet_on"),
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
  /** YouTube video id: the card plays inline and can be watched together. */
  youtubeId?: string;
  /** A real recording (e.g. a bird song) with its own licence and credit. */
  audioUrl?: string;
  audioCredit?: string;
  audioLicense?: string;
  /** Where the image came from: the feed itself, the article preview, or a licensed photo. */
  imageOrigin?: "feed" | "preview" | "licensed" | "youtube" | "none";
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

/**
 * Photos, stored in Postgres so no paid image host is needed. Browsers
 * compress to ≤1600px WebP (~150–400 KB) before upload; Neon's free storage
 * holds a couple of thousand of these.
 */
export const photos = pgTable(
  "photos",
  {
    id: id(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").notNull().references(() => people.id),
    mime: text("mime").notNull(),
    bytes: text("bytes").notNull(), // base64: portable across PGlite and node-postgres
    width: integer("width"),
    height: integer("height"),
    caption: text("caption"),
    createdAt: createdAt(),
  },
  (t) => [index("photos_rel_created").on(t.relationshipId, t.createdAt)],
);

// ─── Gallery ──────────────────────────────────────────────────────────────

/**
 * Everything either of you posts: photos, videos, songs. Files live in object
 * storage (private); YouTube songs and videos are stored as their video id.
 */
export const media = pgTable(
  "media",
  {
    id: id(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    addedBy: uuid("added_by").notNull().references(() => people.id),
    /** photo | video | song */
    kind: text("kind").notNull(),
    /** upload | youtube */
    source: text("source").notNull(),
    path: text("path"),
    thumbPath: text("thumb_path"),
    youtubeId: text("youtube_id"),
    mime: text("mime"),
    bytes: integer("bytes"),
    width: integer("width"),
    height: integer("height"),
    durationSec: real("duration_sec"),
    title: text("title"),
    artist: text("artist"),
    caption: text("caption"),
    takenOn: date("taken_on"),
    createdAt: createdAt(),
  },
  (t) => [index("media_rel_created").on(t.relationshipId, t.createdAt, t.id), index("media_rel_kind").on(t.relationshipId, t.kind, t.createdAt)],
);

export const mediaReactions = pgTable(
  "media_reactions",
  {
    mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.personId] })],
);

export const mediaComments = pgTable(
  "media_comments",
  {
    id: id(),
    mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("media_comments_media").on(t.mediaId, t.createdAt)],
);

// ─── Together: presence, the shared room, and its live events ─────────────

/** Heartbeat per person: online = seen in the last ~70 seconds. */
export const presence = pgTable("presence", {
  personId: uuid("person_id").primaryKey().references(() => people.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  /** Which part of the site they're on, e.g. "room", "gallery". */
  place: text("place"),
});

/**
 * The shared player. Everyone in the relationship sees the same row; clients
 * poll it and steer their own player to match. `version` guards against two
 * people pressing a button at the same moment.
 */
export const roomState = pgTable("room_state", {
  relationshipId: uuid("relationship_id").primaryKey().references(() => relationships.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  mediaId: uuid("media_id").references(() => media.id, { onDelete: "set null" }),
  /** For discovery videos (knitting tutorials, bird videos) that aren't in the gallery. */
  youtubeId: text("youtube_id"),
  title: text("title"),
  playing: boolean("playing").notNull().default(false),
  /** Seconds into the track at `updatedAt`. */
  position: real("position").notNull().default(0),
  queue: uuid("queue").array().notNull().default(sql`'{}'::uuid[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => people.id),
});

/** Chat lines, floating reactions and "thinking of you" nudges, in order. */
export const roomEvents = pgTable(
  "room_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    /** chat | react | nudge | system */
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("room_events_rel_id").on(t.relationshipId, t.id)],
);

/** One answer each to the question of the day. */
export const dailyAnswers = pgTable(
  "daily_answers",
  {
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.relationshipId, t.day, t.personId] })],
);

// ─── Messages: the couple's private chat ──────────────────────────────────

/**
 * One row per chat message. Calls also leave a line here ("Missed video
 * call", "Voice call · 4:12"). Deleting for everyone keeps the row (so replies
 * and order survive) but blanks the body; deleting for me hides it from me.
 * Every change bumps `updated_at`, which is what clients poll on.
 */
export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    /** Generated by the sending device, so a retried send is stored once. */
    clientId: text("client_id"),
    /** text | call */
    kind: text("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    replyToId: bigint("reply_to_id", { mode: "number" }),
    meta: jsonb("meta").$type<MessageMeta>(),
    /** person id → emoji */
    reactions: jsonb("reactions").$type<Record<string, string>>().notNull().default({}),
    hiddenFor: uuid("hidden_for").array().notNull().default(sql`'{}'::uuid[]`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("messages_rel_id").on(t.relationshipId, t.id),
    index("messages_rel_updated").on(t.relationshipId, t.updatedAt),
    uniqueIndex("messages_rel_client").on(t.relationshipId, t.clientId),
  ],
);

export type MessageMeta = {
  /** For call lines. */
  callId?: string;
  callKind?: "audio" | "video";
  outcome?: "completed" | "missed" | "declined" | "cancelled" | "busy" | "failed";
  durationSec?: number;
};

/** Per person: how far they've read and received, and whether they're typing. */
export const chatState = pgTable("chat_state", {
  personId: uuid("person_id").primaryKey().references(() => people.id, { onDelete: "cascade" }),
  relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
  lastReadId: bigint("last_read_id", { mode: "number" }).notNull().default(0),
  lastDeliveredId: bigint("last_delivered_id", { mode: "number" }).notNull().default(0),
  typingUntil: timestamp("typing_until", { withTimezone: true }),
  updatedAt: updatedAt(),
});

// ─── Calls: voice and video, peer to peer ─────────────────────────────────

/**
 * A call's lifecycle: calling → ringing (the other phone got it) → active →
 * ended, or missed / declined / cancelled / busy / failed. At most one live
 * call per relationship, enforced by a partial unique index. Media never
 * touches the server: it flows browser to browser over WebRTC, and these rows
 * only carry the handshake.
 */
export const calls = pgTable(
  "calls",
  {
    id: id(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    callerId: uuid("caller_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    calleeId: uuid("callee_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    /** audio | video */
    kind: text("kind").notNull(),
    status: text("status").notNull().default("calling"),
    createdAt: createdAt(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedBy: uuid("ended_by"),
    callerSeenAt: timestamp("caller_seen_at", { withTimezone: true }).notNull().defaultNow(),
    calleeSeenAt: timestamp("callee_seen_at", { withTimezone: true }),
    /** When the callee's phones were last alerted by push, so an unanswered call keeps ringing. */
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    pushCount: integer("push_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("calls_one_live").on(t.relationshipId).where(sql`status in ('calling', 'ringing', 'active')`),
    index("calls_rel_created").on(t.relationshipId, t.createdAt),
  ],
);

/** SDP offers/answers and ICE candidates, relayed in order between the two phones. */
export const callSignals = pgTable(
  "call_signals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    callId: uuid("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
    fromId: uuid("from_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    /** offer | answer | ice | restart */
    kind: text("kind").notNull(),
    payload: text("payload").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("call_signals_call_id").on(t.callId, t.id)],
);

/** Browser push subscriptions: calls ring and messages arrive even when the site is closed. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("push_endpoint").on(t.endpoint), index("push_person").on(t.personId)],
);

/** Small shared settings every server instance should agree on (e.g. the media signing delegation). */
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: updatedAt(),
});
