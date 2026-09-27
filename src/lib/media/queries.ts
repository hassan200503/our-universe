import "server-only";
import { and, count, desc, eq, gt, inArray, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { media, mediaComments, mediaReactions, people } from "@/lib/db/schema";
import type { Ctx } from "@/lib/context";
import { viewUrls } from "./storage";
import { youtubeThumb } from "./youtube";

export type MediaCard = {
  id: string;
  kind: "photo" | "video" | "song";
  source: "upload" | "youtube";
  youtubeId: string | null;
  title: string | null;
  artist: string | null;
  caption: string | null;
  takenOn: string | null;
  createdAt: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mime: string | null;
  by: { slug: string; name: string; theme: string };
  thumbUrl: string | null;
  url: string | null;
  reactions: Record<string, string>;
  comments: number;
  isNew: boolean;
};

type Row = typeof media.$inferSelect & { bySlug: string; byName: string; byTheme: string };

export async function toCards(ctx: Ctx, rows: Row[], full = true): Promise<MediaCard[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const [reacts, counts, urls] = await Promise.all([
    db
      .select({ mediaId: mediaReactions.mediaId, emoji: mediaReactions.emoji, slug: people.slug })
      .from(mediaReactions)
      .innerJoin(people, eq(people.id, mediaReactions.personId))
      .where(inArray(mediaReactions.mediaId, ids)),
    db.select({ mediaId: mediaComments.mediaId, n: count() }).from(mediaComments).where(inArray(mediaComments.mediaId, ids)).groupBy(mediaComments.mediaId),
    viewUrls(rows.flatMap((r) => [r.thumbPath, full ? r.path : null])),
  ]);
  const seen = ctx.me.gallerySeenAt ? new Date(ctx.me.gallerySeenAt).getTime() : 0;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as MediaCard["kind"],
    source: r.source as MediaCard["source"],
    youtubeId: r.youtubeId,
    title: r.title,
    artist: r.artist,
    caption: r.caption,
    takenOn: r.takenOn,
    createdAt: r.createdAt.toISOString(),
    width: r.width,
    height: r.height,
    durationSec: r.durationSec,
    mime: r.mime,
    by: { slug: r.bySlug, name: r.byName, theme: r.byTheme },
    thumbUrl: r.youtubeId ? youtubeThumb(r.youtubeId) : ((r.thumbPath && urls.get(r.thumbPath)) || (r.kind === "photo" && r.path ? urls.get(r.path) : null) || null),
    url: r.path ? (urls.get(r.path) ?? null) : null,
    reactions: Object.fromEntries(reacts.filter((x) => x.mediaId === r.id).map((x) => [x.slug, x.emoji])),
    comments: counts.find((c) => c.mediaId === r.id)?.n ?? 0,
    isNew: r.addedBy !== ctx.me.id && r.createdAt.getTime() > seen,
  }));
}

const withPerson = {
  id: media.id,
  relationshipId: media.relationshipId,
  addedBy: media.addedBy,
  kind: media.kind,
  source: media.source,
  path: media.path,
  thumbPath: media.thumbPath,
  youtubeId: media.youtubeId,
  mime: media.mime,
  bytes: media.bytes,
  width: media.width,
  height: media.height,
  durationSec: media.durationSec,
  title: media.title,
  artist: media.artist,
  caption: media.caption,
  takenOn: media.takenOn,
  createdAt: media.createdAt,
  bySlug: people.slug,
  byName: people.displayName,
  byTheme: people.theme,
};

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function dec(c: string | null | undefined): [string, string] | null {
  if (!c) return null;
  try {
    return JSON.parse(Buffer.from(c, "base64url").toString());
  } catch {
    return null;
  }
}

/** One page of the shared gallery, newest first, keyset-paginated. */
export async function galleryPage(ctx: Ctx, opts: { kind?: string | null; by?: string | null; cursor?: string | null; limit?: number }) {
  const db = await getDb();
  const limit = Math.min(opts.limit ?? 24, 60);
  const c = dec(opts.cursor);
  const by = opts.by ? ctx.members.find((m) => m.slug === opts.by) : null;
  const filters: (SQL | undefined)[] = [
    eq(media.relationshipId, ctx.relationship.id),
    opts.kind && ["photo", "video", "song"].includes(opts.kind) ? eq(media.kind, opts.kind) : undefined,
    by ? eq(media.addedBy, by.id) : undefined,
    c ? sql`(${media.createdAt}, ${media.id}) < (${c[0]}::timestamptz, ${c[1]}::uuid)` : undefined,
  ];
  const rows = await db
    .select(withPerson)
    .from(media)
    .innerJoin(people, eq(people.id, media.addedBy))
    .where(and(...filters))
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return { items: await toCards(ctx, page), nextCursor: rows.length > limit && last ? enc([last.createdAt.toISOString(), last.id]) : null };
}

export async function mediaByIds(ctx: Ctx, ids: string[]): Promise<MediaCard[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db
    .select(withPerson)
    .from(media)
    .innerJoin(people, eq(people.id, media.addedBy))
    .where(and(eq(media.relationshipId, ctx.relationship.id), inArray(media.id, ids)));
  const cards = await toCards(ctx, rows);
  return ids.map((id) => cards.find((c) => c.id === id)).filter((c): c is MediaCard => !!c);
}

export async function mediaComments_(ctx: Ctx, id: string) {
  const db = await getDb();
  return db
    .select({ id: mediaComments.id, body: mediaComments.body, createdAt: mediaComments.createdAt, slug: people.slug, name: people.displayName, personId: people.id })
    .from(mediaComments)
    .innerJoin(people, eq(people.id, mediaComments.personId))
    .innerJoin(media, eq(media.id, mediaComments.mediaId))
    .where(and(eq(mediaComments.mediaId, id), eq(media.relationshipId, ctx.relationship.id)))
    .orderBy(mediaComments.createdAt);
}

/** New posts from the other person since I last opened the gallery. */
export async function unseenCount(ctx: Ctx): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(media)
    .where(
      and(
        eq(media.relationshipId, ctx.relationship.id),
        ne(media.addedBy, ctx.me.id),
        ctx.me.gallerySeenAt ? gt(media.createdAt, new Date(ctx.me.gallerySeenAt)) : undefined,
      ),
    );
  return row?.n ?? 0;
}

export async function recentMedia(ctx: Ctx, limit = 6): Promise<MediaCard[]> {
  return (await galleryPage(ctx, { limit })).items;
}
