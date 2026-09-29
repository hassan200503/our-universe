import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, withSchema } from "@/lib/db/client";
import { kv } from "@/lib/db/schema";

/**
 * Secrets the two of you paste into Settings (the Gemini key, a call relay
 * key), kept in the database sealed with AES-256-GCM under a key derived from
 * the deployment's own secret. They never reach the browser and never live in
 * the code. An environment variable with the same purpose always wins.
 */
function sealKey(): Buffer {
  const base = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : (process.env.DATABASE_URL ?? "dev-only-secret-not-for-production-use-000");
  return createHmac("sha256", base).update("our-universe/settings-seal-v1").digest();
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal<T>(sealed: string): T | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

type Stored = { sealed: string; hint?: string; by?: string; at?: string };

// One cache per server process: route handlers and server actions can be separate bundles, and a save in one must be seen by the others.
const g = globalThis as unknown as { __secrets?: Map<string, { at: number; value: unknown }> };
const cache = (g.__secrets ??= new Map());
const TTL = 60_000;
const TTL_UNSET = 5_000; // "not set" is re-checked quickly, so a key saved on another server instance is picked up almost at once

export async function readSecret<T>(key: string): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value === null ? TTL_UNSET : TTL)) return hit.value as T | null;
  const db = await getDb();
  const row = await withSchema(async () => (await db.select().from(kv).where(eq(kv.key, key)))[0]).catch(() => undefined);
  const value = row ? unseal<T>((row.value as Stored).sealed) : null;
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Stores (or with null, removes) a secret. `hint` is a safe preview such as the last four characters. */
export async function writeSecret(key: string, value: unknown | null, meta: { hint?: string; by?: string } = {}) {
  const db = await getDb();
  cache.delete(key);
  if (value === null) {
    await withSchema(() => db.delete(kv).where(eq(kv.key, key)));
    return;
  }
  const stored: Stored = { sealed: seal(value), hint: meta.hint, by: meta.by, at: new Date().toISOString() };
  await withSchema(() =>
    db
      .insert(kv)
      .values({ key, value: stored })
      .onConflictDoUpdate({ target: kv.key, set: { value: stored, updatedAt: new Date() } }),
  );
}

/** What Settings may show about a stored secret: whether it's set, a hint, who set it and when. Never the value. */
export async function describeSecret(key: string): Promise<{ set: boolean; hint?: string; by?: string; at?: string }> {
  const db = await getDb();
  const row = await withSchema(async () => (await db.select().from(kv).where(eq(kv.key, key)))[0]).catch(() => undefined);
  if (!row) return { set: false };
  const s = row.value as Stored;
  return { set: true, hint: s.hint, by: s.by, at: s.at };
}

export const SECRET_GEMINI = "secret:gemini-api-key";
export const SECRET_RELAY = "secret:turn-relay";

export type RelayConfig =
  | { provider: "metered"; domain: string; apiKey: string }
  | { provider: "cloudflare"; keyId: string; token: string }
  | { provider: "custom"; urls: string[]; username: string; credential: string };
