"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { media, mediaComments, mediaReactions, people, roomEvents } from "@/lib/db/schema";
import { requireCtx } from "@/lib/context";
import { ALLOWED_TYPES, LIMITS, inspect, newPath, ownsPath, remove, storageMode, type StorageMode } from "@/lib/media/storage";
import { youtubeIdFrom } from "@/lib/media/youtube";

export type Prepared = { ok: true; mode: Exclude<StorageMode, "none">; path: string; thumbPath: string | null } | { ok: false; error: string };

const KIND = z.enum(["photo", "video", "song", "avatar"]);

/** Step 1 of an upload: the server picks the object path and checks type and size. */
export async function prepareUpload(kind: string, mime: string, size: number): Promise<Prepared> {
  const ctx = await requireCtx();
  const mode = storageMode();
  if (mode === "none") return { ok: false, error: "Photo & video storage isn't switched on yet. Hassan can connect it in Vercel → Storage → Blob." };
  const k = KIND.safeParse(kind);
  if (!k.success) return { ok: false, error: "Unknown kind" };
  if (!ALLOWED_TYPES.includes(mime)) return { ok: false, error: `${mime || "This file type"} isn't supported. Use a photo, MP4/MOV/WebM video, or MP3/M4A/WAV audio.` };
  const max = k.data === "avatar" ? LIMITS.thumb : LIMITS[k.data];
  if (size > max) return { ok: false, error: `Too large: the limit for ${k.data}s is ${Math.round(max / 1024 / 1024)} MB.` };
  const rel = ctx.relationship.id;
  return {
    ok: true,
    mode,
    path: newPath(rel, k.data, mime),
    thumbPath: k.data === "photo" || k.data === "video" ? newPath(rel, "thumb", "image/webp") : null,
  };
}

const saved = z.object({
  kind: z.enum(["photo", "video", "song"]),
  path: z.string(),
  thumbPath: z.string().nullable().optional(),
  mime: z.string().max(80),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  durationSec: z.number().nonnegative().max(60 * 60 * 6).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  artist: z.string().max(200).nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Step 2: record an uploaded file, after confirming it really exists in our folder. */
export async function saveUploaded(input: z.infer<typeof saved>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await requireCtx();
  const parsed = saved.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload" };
  const d = parsed.data;
  const rel = ctx.relationship.id;
  if (!ownsPath(rel, d.path) || (d.thumbPath && !ownsPath(rel, d.thumbPath))) return { ok: false, error: "Not your folder" };
  const info = await inspect(d.path);
  if (!info) return { ok: false, error: "The upload didn't finish. Please try again." };
  const db = await getDb();
  const [row] = await db
    .insert(media)
    .values({
      relationshipId: rel,
      addedBy: ctx.me.id,
      kind: d.kind,
      source: "upload",
      path: d.path,
      thumbPath: d.thumbPath && (await inspect(d.thumbPath)) ? d.thumbPath : null,
      mime: info.contentType ?? d.mime,
      bytes: info.size,
      width: d.width ?? null,
      height: d.height ?? null,
      durationSec: d.durationSec ?? null,
      title: d.title?.trim() || null,
      artist: d.artist?.trim() || null,
      caption: d.caption?.trim() || null,
      takenOn: d.takenOn ?? null,
    })
    .returning({ id: media.id });
  revalidatePath("/gallery");
  return { ok: true, id: row.id };
}

/** Songs and videos from YouTube: full tracks, no storage used. */
export async function addYouTube(_: unknown, fd: FormData): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const ctx = await requireCtx();
  const id = youtubeIdFrom(String(fd.get("url") ?? ""));
  if (!id) return { error: "That doesn't look like a YouTube link." };
  const kind = fd.get("kind") === "video" ? "video" : "song";
  const caption = String(fd.get("caption") ?? "").trim().slice(0, 2000) || null;
  let title: string | null = null;
  let artist: string | null = null;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const j = (await res.json()) as { title?: string; author_name?: string };
      title = j.title?.slice(0, 200) ?? null;
      artist = j.author_name?.replace(/ - Topic$/, "").slice(0, 200) ?? null;
    }
  } catch {
    // The title is a nicety; the video plays without it.
  }
  const db = await getDb();
  await db.insert(media).values({ relationshipId: ctx.relationship.id, addedBy: ctx.me.id, kind, source: "youtube", youtubeId: id, title, artist, caption });
  revalidatePath("/gallery");
  return { ok: true, message: kind === "song" ? "Song added 🎶" : "Video added 🎬" };
}

async function ownMedia(id: string) {
  const ctx = await requireCtx();
  if (!z.uuid().safeParse(id).success) return null;
  const db = await getDb();
  const [row] = await db.select().from(media).where(and(eq(media.id, id), eq(media.relationshipId, ctx.relationship.id)));
  return row ? { ctx, db, row } : null;
}

/** Only the person who posted something can delete it. */
export async function deleteMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  const found = await ownMedia(id);
  if (!found) return { ok: false, error: "Not found" };
  if (found.row.addedBy !== found.ctx.me.id) return { ok: false, error: "Only the person who posted it can delete it" };
  const { db, row } = found;
  const inUseAsAvatar = row.path ? await db.select({ id: people.id }).from(people).where(eq(people.avatarPath, row.thumbPath ?? row.path)) : [];
  await db.delete(media).where(eq(media.id, id));
  // Keep a thumbnail that someone is using as their profile picture.
  await remove([row.path, inUseAsAvatar.length ? null : row.thumbPath]);
  revalidatePath("/gallery");
  return { ok: true };
}

const EMOJI = ["❤️", "😍", "🥹", "😂", "🔥", "😮"];

export async function reactToMedia(id: string, emoji: string | null): Promise<{ ok: boolean }> {
  const found = await ownMedia(id);
  if (!found) return { ok: false };
  const { db, ctx } = found;
  const where = and(eq(mediaReactions.mediaId, id), eq(mediaReactions.personId, ctx.me.id));
  if (!emoji || !EMOJI.includes(emoji)) await db.delete(mediaReactions).where(where);
  else
    await db
      .insert(mediaReactions)
      .values({ mediaId: id, personId: ctx.me.id, emoji })
      .onConflictDoUpdate({ target: [mediaReactions.mediaId, mediaReactions.personId], set: { emoji, createdAt: new Date() } });
  return { ok: true };
}

export async function commentOnMedia(id: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const found = await ownMedia(id);
  if (!found) return { ok: false, error: "Not found" };
  const text = body.trim().slice(0, 1000);
  if (!text) return { ok: false, error: "Write something first" };
  await found.db.insert(mediaComments).values({ mediaId: id, personId: found.ctx.me.id, body: text });
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<void> {
  const ctx = await requireCtx();
  if (!z.uuid().safeParse(commentId).success) return;
  const db = await getDb();
  await db.delete(mediaComments).where(and(eq(mediaComments.id, commentId), eq(mediaComments.personId, ctx.me.id)));
}

/** Use an uploaded square picture (from Settings) as my profile picture. */
export async function setAvatar(p: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireCtx();
  if (!ownsPath(ctx.relationship.id, p) || !(await inspect(p))) return { ok: false, error: "Upload didn't finish" };
  const db = await getDb();
  const [old] = await db.select({ avatarPath: people.avatarPath }).from(people).where(eq(people.id, ctx.me.id));
  await db.update(people).set({ avatarPath: p }).where(eq(people.id, ctx.me.id));
  // Remove the old avatar file only if it was a dedicated avatar upload.
  if (old?.avatarPath?.includes("/avatar/") && old.avatarPath !== p) await remove([old.avatarPath]);
  await db.insert(roomEvents).values({ relationshipId: ctx.relationship.id, personId: ctx.me.id, kind: "system", body: "updated their profile picture" });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Set as my profile picture" from a photo in the gallery (uses its thumbnail). */
export async function setAvatarFromMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  const found = await ownMedia(id);
  if (!found || found.row.kind !== "photo") return { ok: false, error: "Choose a photo" };
  const p = found.row.thumbPath ?? found.row.path;
  if (!p) return { ok: false, error: "No file" };
  await found.db.update(people).set({ avatarPath: p }).where(eq(people.id, found.ctx.me.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<void> {
  const ctx = await requireCtx();
  const db = await getDb();
  await db.update(people).set({ avatarPath: null }).where(eq(people.id, ctx.me.id));
  revalidatePath("/", "layout");
}

export async function markGallerySeen(): Promise<void> {
  const ctx = await requireCtx();
  const db = await getDb();
  await db.update(people).set({ gallerySeenAt: new Date() }).where(eq(people.id, ctx.me.id));
}
