import "server-only";
import { createECDH, createHmac } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";

/**
 * Web Push: a call rings and a message arrives on the phone even when Our
 * Universe isn't open. The VAPID key pair comes from VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY when set; otherwise it's derived from the same secret as
 * the session key, so a deployment needs no extra settings.
 */
function b64url(buf: Buffer) {
  return buf.toString("base64url");
}

let keys: { publicKey: string; privateKey: string } | null = null;
export function vapidKeys() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return keys;
  }
  const secret = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : (process.env.DATABASE_URL ?? "dev-only-secret-not-for-production-use-000");
  for (let i = 0; ; i++) {
    const priv = createHmac("sha256", secret).update(`our-universe/vapid-v1/${i}`).digest();
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(priv);
      keys = { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(priv) };
      return keys;
    } catch {
      // A scalar outside the curve order (vanishingly rare): derive the next one.
    }
  }
}

export type PushPayload =
  | { type: "message"; title: string; body: string; url: string; tag: string; unread?: number }
  | { type: "call"; callId: string; kind: "audio" | "video"; title: string; body: string; url: string; token: string }
  | { type: "call-end"; callId: string; reason: "answered" | "missed" | "declined"; title: string; kind: "audio" | "video" };

type Options = { ttl: number; urgency: "high" | "normal" };

/** Sends to every device the person has turned alerts on for. Dead subscriptions are removed. */
export async function pushTo(personIds: string[], payload: PushPayload, opts: Options = { ttl: 3600, urgency: "normal" }): Promise<number> {
  if (!personIds.length) return 0;
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.personId, personIds));
  if (!subs.length) return 0;
  const webpush = (await import("web-push")).default;
  const { publicKey, privateKey } = vapidKeys();
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const ok: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: { subject: "mailto:our-universe@users.noreply.github.com", publicKey, privateKey },
          TTL: opts.ttl,
          urgency: opts.urgency,
          timeout: 5000,
        });
        ok.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410 || status === 403) dead.push(s.id);
      }
    }),
  );
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  if (ok.length) await db.update(pushSubscriptions).set({ lastSuccessAt: sql`now()` }).where(inArray(pushSubscriptions.id, ok));
  return ok.length;
}

export async function saveSubscription(ctx: Ctx, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null) {
  const db = await getDb();
  await db
    .insert(pushSubscriptions)
    .values({ personId: ctx.me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { personId: ctx.me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent } });
}

export async function removeSubscription(ctx: Ctx, endpoint: string) {
  const db = await getDb();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.personId, ctx.me.id)));
}

export async function hasSubscription(personId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.personId, personId)).limit(1);
  return !!row;
}
