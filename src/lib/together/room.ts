import "server-only";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { presence, roomEvents, roomState } from "@/lib/db/schema";
import { mediaByIds, type MediaCard } from "@/lib/media/queries";

export type RoomPayload = {
  serverNow: string;
  version: number;
  state?: {
    playing: boolean;
    position: number;
    updatedAt: string;
    updatedBy: string | null;
    current: MediaCard | null;
    youtube: { id: string; title: string | null } | null;
    queue: MediaCard[];
  };
  events: { id: number; kind: string; body: string; slug: string; createdAt: string }[];
  partners: { slug: string; here: boolean; online: boolean; lastSeenAt: string | null }[];
};

const ONLINE_MS = 70_000;
const HERE_MS = 12_000;

async function ensureRow(ctx: Ctx) {
  const db = await getDb();
  await db.insert(roomState).values({ relationshipId: ctx.relationship.id }).onConflictDoNothing();
  const [row] = await db.select().from(roomState).where(eq(roomState.relationshipId, ctx.relationship.id));
  return row;
}

/** Everything a client needs to steer its player; the full state only when it changed. */
export async function readRoom(ctx: Ctx, knownVersion: number | null, afterEvent: number | null): Promise<RoomPayload> {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(presence)
    .values({ personId: ctx.me.id, lastSeenAt: now, place: "room" })
    .onConflictDoUpdate({ target: presence.personId, set: { lastSeenAt: now, place: "room" } });

  const row = await ensureRow(ctx);
  const partnerIds = ctx.partners.map((p) => p.id);
  const [events, states] = await Promise.all([
    afterEvent === null
      ? db
          .select()
          .from(roomEvents)
          .where(and(eq(roomEvents.relationshipId, ctx.relationship.id), inArray(roomEvents.kind, ["chat", "react", "system"])))
          .orderBy(desc(roomEvents.id))
          .limit(40)
          .then((r) => r.reverse())
      : db
          .select()
          .from(roomEvents)
          .where(and(eq(roomEvents.relationshipId, ctx.relationship.id), gt(roomEvents.id, afterEvent)))
          .orderBy(roomEvents.id)
          .limit(100),
    partnerIds.length ? db.select().from(presence).where(inArray(presence.personId, partnerIds)) : Promise.resolve([]),
  ]);

  const slug = (id: string | null) => ctx.members.find((m) => m.id === id)?.slug ?? "";
  const payload: RoomPayload = {
    serverNow: now.toISOString(),
    version: row.version,
    events: events.map((e) => ({ id: e.id, kind: e.kind, body: e.body, slug: slug(e.personId), createdAt: e.createdAt.toISOString() })),
    partners: ctx.partners.map((p) => {
      const s = states.find((x) => x.personId === p.id);
      const age = s ? now.getTime() - s.lastSeenAt.getTime() : Infinity;
      return { slug: p.slug, online: !!s && s.place !== "away" && age < ONLINE_MS, here: !!s && s.place === "room" && age < HERE_MS, lastSeenAt: s?.lastSeenAt.toISOString() ?? null };
    }),
  };

  if (knownVersion !== row.version) {
    const ids = [row.mediaId, ...row.queue].filter((x): x is string => !!x);
    const cards = await mediaByIds(ctx, ids);
    payload.state = {
      playing: row.playing,
      position: row.position,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: slug(row.updatedBy),
      current: row.mediaId ? (cards.find((c) => c.id === row.mediaId) ?? null) : null,
      youtube: !row.mediaId && row.youtubeId ? { id: row.youtubeId, title: row.title } : null,
      queue: row.queue.map((id) => cards.find((c) => c.id === id)).filter((c): c is MediaCard => !!c),
    };
  }
  return payload;
}

export const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("load"), mediaId: z.uuid().optional(), youtubeId: z.string().regex(/^[\w-]{11}$/).optional(), title: z.string().max(200).optional(), play: z.boolean().default(true) }),
  z.object({ type: z.literal("play"), position: z.number().min(0).max(86400) }),
  z.object({ type: z.literal("pause"), position: z.number().min(0).max(86400) }),
  z.object({ type: z.literal("seek"), position: z.number().min(0).max(86400) }),
  z.object({ type: z.literal("next") }),
  z.object({ type: z.literal("ended"), key: z.string().max(64) }),
  z.object({ type: z.literal("queue"), mediaId: z.uuid() }),
  z.object({ type: z.literal("dequeue"), mediaId: z.uuid() }),
  z.object({ type: z.literal("chat"), body: z.string().min(1).max(500) }),
  z.object({ type: z.literal("react"), emoji: z.enum(["❤️", "😂", "😍", "🔥", "😮", "👏", "🥹", "💃"]) }),
]);
export type RoomAction = z.infer<typeof action>;

async function youtubeTitle(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? (((await res.json()) as { title?: string }).title?.slice(0, 200) ?? null) : null;
  } catch {
    return null;
  }
}

const titleOf = (c: MediaCard | undefined) => c?.title ?? (c?.kind === "photo" ? "a photo" : c?.kind === "video" ? "a video" : "a song");

/** Applies one action. Player changes bump the version so every client re-syncs. */
export async function applyRoom(ctx: Ctx, a: RoomAction): Promise<void> {
  const db = await getDb();
  const rel = ctx.relationship.id;
  const row = await ensureRow(ctx);
  const bump = { version: sql`${roomState.version} + 1`, updatedAt: new Date(), updatedBy: ctx.me.id };
  const log = (kind: string, body: string) => db.insert(roomEvents).values({ relationshipId: rel, personId: ctx.me.id, kind, body });

  switch (a.type) {
    case "chat":
      await log("chat", a.body.trim());
      return;
    case "react":
      await log("react", a.emoji);
      return;
    case "play":
    case "pause":
    case "seek":
      await db
        .update(roomState)
        .set({ ...bump, position: a.position, ...(a.type === "seek" ? {} : { playing: a.type === "play" }) })
        .where(eq(roomState.relationshipId, rel));
      return;
    case "load": {
      if (a.mediaId) {
        const [card] = await mediaByIds(ctx, [a.mediaId]);
        if (!card || card.kind === "photo") return;
        await db
          .update(roomState)
          .set({ ...bump, mediaId: card.id, youtubeId: null, title: null, position: 0, playing: a.play, queue: row.queue.filter((q) => q !== card.id) })
          .where(eq(roomState.relationshipId, rel));
        await log("system", `started ${card.kind === "song" ? "playing" : "watching"} ${titleOf(card)}`);
      } else if (a.youtubeId) {
        if (!a.title) a.title = (await youtubeTitle(a.youtubeId)) ?? undefined;
        await db
          .update(roomState)
          .set({ ...bump, mediaId: null, youtubeId: a.youtubeId, title: a.title ?? null, position: 0, playing: a.play })
          .where(eq(roomState.relationshipId, rel));
        await log("system", `started ${a.title ? `“${a.title}”` : "a video"}`);
      }
      return;
    }
    case "next":
    case "ended": {
      // "ended" names the track that finished, so two phones finishing together advance only once.
      const currentKey = row.mediaId ?? row.youtubeId ?? "";
      if (a.type === "ended" && a.key !== currentKey) return;
      const [nextId, ...rest] = row.queue;
      await db
        .update(roomState)
        .set(nextId ? { ...bump, mediaId: nextId, youtubeId: null, title: null, position: 0, playing: true, queue: rest } : { ...bump, playing: false, position: 0 })
        .where(eq(roomState.relationshipId, rel));
      return;
    }
    case "queue": {
      const [card] = await mediaByIds(ctx, [a.mediaId]);
      if (!card || card.kind === "photo" || row.queue.includes(card.id)) return;
      await db
        .update(roomState)
        .set({ ...bump, queue: [...row.queue, card.id] })
        .where(eq(roomState.relationshipId, rel));
      await log("system", `queued ${titleOf(card)}`);
      return;
    }
    case "dequeue":
      await db
        .update(roomState)
        .set({ ...bump, queue: row.queue.filter((q) => q !== a.mediaId) })
        .where(eq(roomState.relationshipId, rel));
      return;
  }
}
