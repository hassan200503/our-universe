import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";

/**
 * Where photos, videos and songs live.
 *
 *  - "blob":  private Vercel Blob storage (production). Browsers upload
 *             straight to it and read through short-lived signed URLs served
 *             from Vercel's CDN, so large videos never pass through our
 *             functions and seeking is instant.
 *  - "local": files under .data/media (development), served by our own route.
 *  - "none":  deployed without a Blob store: uploads are refused with a clear
 *             message instead of being written to a disk that vanishes.
 *
 * Every object lives under rel/<relationshipId>/, which is how access is checked.
 */
export type StorageMode = "blob" | "local" | "none";

export function storageMode(): StorageMode {
  // A read-write token, or an OIDC-connected store (Vercel's default), both mean Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  if (process.env.VERCEL) return "none";
  return "local";
}

export const LOCAL_ROOT = path.join(process.cwd(), ".data", "media");

export const LIMITS = {
  photo: 25 * 1024 * 1024,
  // The free Blob plan holds 1 GB in total: keep single files modest; long videos go on YouTube.
  song: 30 * 1024 * 1024,
  video: 150 * 1024 * 1024,
  thumb: 2 * 1024 * 1024,
} as const;

export const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png", "image/gif", "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm", "audio/x-m4a"];

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
};

/** A fresh, unguessable object path inside the relationship's folder. */
export function newPath(relationshipId: string, folder: "photo" | "video" | "song" | "thumb" | "avatar", mime: string): string {
  return `rel/${relationshipId}/${folder}/${randomUUID()}.${EXT[mime] ?? "bin"}`;
}

export function ownsPath(relationshipId: string, p: string | null | undefined): p is string {
  return !!p && p.startsWith(`rel/${relationshipId}/`) && !p.includes("..") && /^[\w/.-]+$/.test(p);
}

// ─── Signed reads (blob) ──────────────────────────────────────────────────

type Delegation = { delegationToken: string; clientSigningToken: string; validUntil: number };
const g = globalThis as unknown as { __blobDelegation?: Promise<Delegation> };
const HOUR = 3600_000;
const KV_KEY = "blob-read-delegation";

/**
 * The read delegation is shared by every server instance (kept in the kv
 * table), because it's part of each signed URL: one shared delegation means a
 * file has the same URL no matter which instance signed it, so browsers and
 * the CDN keep serving it from cache instead of downloading it again.
 */
async function sharedDelegation(): Promise<Delegation> {
  const { getDb, withSchema } = await import("@/lib/db/client");
  const { kv } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const fresh = (d: Delegation | null | undefined): d is Delegation => !!d && d.validUntil - Date.now() > 7 * HOUR;
  const stored = await withSchema(async () => (await db.select().from(kv).where(eq(kv.key, KV_KEY)))[0]?.value as Delegation | undefined).catch(() => undefined);
  if (fresh(stored)) return stored;
  const { issueSignedToken } = await import("@vercel/blob");
  const issued = await issueSignedToken({ operations: ["get", "head"], validUntil: Date.now() + 12 * HOUR });
  const d: Delegation = { delegationToken: issued.delegationToken, clientSigningToken: issued.clientSigningToken, validUntil: issued.validUntil };
  // If two instances race, the first write wins and both read it back.
  await db
    .insert(kv)
    .values({ key: KV_KEY, value: d, expiresAt: new Date(d.validUntil) })
    .onConflictDoUpdate({ target: kv.key, set: { value: d, expiresAt: new Date(d.validUntil), updatedAt: new Date() }, setWhere: sql`${kv.expiresAt} < ${new Date(Date.now() + 7 * HOUR).toISOString()}::timestamptz` })
    .catch(() => {});
  const [row] = await db.select().from(kv).where(eq(kv.key, KV_KEY)).catch(() => []);
  return fresh(row?.value as Delegation) ? (row!.value as Delegation) : d;
}

async function delegation(): Promise<Delegation> {
  const current = g.__blobDelegation ? await g.__blobDelegation.catch(() => null) : null;
  if (current && current.validUntil - Date.now() > 7 * HOUR) return current;
  g.__blobDelegation = sharedDelegation().catch(async () => {
    const { issueSignedToken } = await import("@vercel/blob");
    return issueSignedToken({ operations: ["get", "head"], validUntil: Date.now() + 12 * HOUR }) as Promise<Delegation>;
  });
  return g.__blobDelegation;
}

/**
 * A URL the browser can load directly. Signed URLs expire at fixed 3-hour
 * boundaries (at least 3 hours ahead), so the same file keeps the same URL for
 * a while and the browser cache stays warm across page loads.
 */
export async function viewUrl(p: string): Promise<string> {
  if (storageMode() !== "blob") return `/api/media/file/${p}`;
  const { presignUrl } = await import("@vercel/blob");
  const d = await delegation();
  const window = 3 * HOUR;
  const validUntil = Math.min(d.validUntil, (Math.floor(Date.now() / window) + 2) * window);
  const { presignedUrl } = await presignUrl(d, { operation: "get", pathname: p, access: "private", validUntil });
  return presignedUrl;
}

export async function viewUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  await Promise.all(unique.map(async (p) => out.set(p, await viewUrl(p).catch(() => ""))));
  return out;
}

/** Confirms an uploaded object exists and returns its real size and type. */
export async function inspect(p: string): Promise<{ size: number; contentType: string | null } | null> {
  const mode = storageMode();
  if (mode === "blob") {
    const { head } = await import("@vercel/blob");
    try {
      const h = await head(p);
      return { size: h.size, contentType: h.contentType };
    } catch {
      return null;
    }
  }
  if (mode === "local") {
    try {
      const s = await stat(path.join(LOCAL_ROOT, p));
      return { size: s.size, contentType: null };
    } catch {
      return null;
    }
  }
  return null;
}

export async function remove(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  const mode = storageMode();
  if (mode === "blob") {
    const { del } = await import("@vercel/blob");
    await del(list).catch(() => {});
  } else if (mode === "local") {
    await Promise.all(list.map((p) => rm(path.join(LOCAL_ROOT, p), { force: true })));
  }
}

export async function ensureLocalDir(p: string) {
  await mkdir(path.dirname(path.join(LOCAL_ROOT, p)), { recursive: true });
}
