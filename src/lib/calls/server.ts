import "server-only";
import { and, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { ctxFor, type Ctx } from "@/lib/context";
import { sign, verifySignature } from "@/lib/auth/session";
import { getDb, withSchema } from "@/lib/db/client";
import { callSignals, calls } from "@/lib/db/schema";
import { logCall } from "@/lib/chat/server";
import type { CallSync, CallView } from "./types";

type Row = typeof calls.$inferSelect;

const LIVE = ["calling", "ringing", "active"];
/** An unanswered call rings for this long. */
export const RING_MS = 45_000;
/**
 * A connected call where neither phone has checked in for this long has
 * ended (both closed or lost). One quiet phone isn't enough: a phone in the
 * background checks in less often, and the other side notices a real drop
 * through the connection itself and hangs up.
 */
const STALE_MS = 45_000;

function view(ctx: Ctx, r: Row): CallView {
  const slug = (id: string | null) => ctx.members.find((m) => m.id === id)?.slug ?? null;
  const role = r.callerId === ctx.me.id ? "caller" : "callee";
  return {
    id: r.id,
    kind: r.kind === "video" ? "video" : "audio",
    status: r.status as CallView["status"],
    role,
    partnerSlug: slug(role === "caller" ? r.calleeId : r.callerId) ?? "",
    createdAt: r.createdAt.toISOString(),
    answeredAt: r.answeredAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    endedBy: slug(r.endedBy),
  };
}

/** Lets "Decline" on a call notification work even on a device that's signed out. */
const declineToken = (row: Pick<Row, "id" | "calleeId">) => sign(`call-decline:${row.id}:${row.calleeId}`);

/**
 * Rings the other person's phones through push. Sent when the call starts and
 * again every few seconds while no open page has picked it up, so a phone in a
 * pocket keeps ringing the way a real call does.
 */
function ringByPush(ctx: Ctx, row: Row) {
  after(async () => {
    const { pushTo } = await import("@/lib/push/server");
    const first = ctx.members.find((m) => m.id === row.callerId)?.displayName.split(" ")[0] ?? "Our Universe";
    const video = row.kind === "video";
    await pushTo(
      [row.calleeId],
      { type: "call", callId: row.id, kind: video ? "video" : "audio", title: first, body: video ? "Incoming video call" : "Incoming voice call", url: `/together/chat?call=${row.id}`, token: declineToken(row) },
      { ttl: 30, urgency: "high" },
    ).catch(() => 0);
  });
}
const REPUSH_MS = 7_000;
const MAX_PUSHES = 6;

const seconds = (from: Date | null, to: Date) => (from ? Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000)) : null);

/**
 * Moves a call to a final state exactly once (the WHERE clause is the guard),
 * then writes its line into the chat and silences any ringing notification.
 */
async function finish(ctx: Ctx, id: string, from: string[], status: string, by: string | null): Promise<Row | null> {
  const db = await getDb();
  const now = new Date();
  const [row] = await db
    .update(calls)
    .set({ status, endedAt: now, endedBy: by })
    .where(and(eq(calls.id, id), eq(calls.relationshipId, ctx.relationship.id), inArray(calls.status, from)))
    .returning();
  if (!row) return null;
  const answered = !!row.answeredAt;
  const outcome = answered ? "completed" : status === "declined" ? "declined" : status === "busy" ? "busy" : status === "failed" ? "failed" : "missed";
  await logCall(ctx, { id: row.id, callerId: row.callerId, kind: row.kind, outcome, durationSec: answered ? seconds(row.answeredAt, now) : null });
  // A call that never connected may still be ringing on a phone: turn it into a missed-call notice.
  if (!answered) {
    const caller = ctx.members.find((m) => m.id === row.callerId)?.displayName.split(" ")[0] ?? "Our Universe";
    after(async () => {
      const { pushTo } = await import("@/lib/push/server");
      await pushTo([row.calleeId], { type: "call-end", callId: row.id, reason: status === "declined" ? "declined" : "missed", title: caller, kind: row.kind === "video" ? "video" : "audio" }, { ttl: 3600, urgency: "high" }).catch(() => 0);
    });
  }
  return row;
}

/** Calls nobody answered, and connected calls whose phones went quiet, are closed off. */
async function expireStale(ctx: Ctx) {
  const db = await getDb();
  const now = Date.now();
  const stale = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.relationshipId, ctx.relationship.id),
        or(
          and(inArray(calls.status, ["calling", "ringing"]), lt(calls.createdAt, new Date(now - RING_MS - 15_000))),
          and(eq(calls.status, "active"), sql`greatest(${calls.callerSeenAt}, coalesce(${calls.calleeSeenAt}, ${calls.callerSeenAt})) < ${new Date(now - STALE_MS).toISOString()}::timestamptz`),
        ),
      ),
    );
  for (const r of stale) await finish(ctx, r.id, [r.status], r.status === "active" ? "ended" : "missed", null);
}

async function live(ctx: Ctx): Promise<Row | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.relationshipId, ctx.relationship.id), inArray(calls.status, LIVE)))
    .limit(1);
  return row ?? null;
}

async function mine(ctx: Ctx, id: string): Promise<Row | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, id), eq(calls.relationshipId, ctx.relationship.id), or(eq(calls.callerId, ctx.me.id), eq(calls.calleeId, ctx.me.id))));
  return row ?? null;
}

/** The live call I'm part of, if any: how an incoming call is noticed anywhere on the site. */
export function currentCall(ctx: Ctx): Promise<CallView | null> {
  return withSchema(async () => {
    const row = await live(ctx);
    if (!row) return null;
    const ringingTooLong = row.status !== "active" && Date.now() - row.createdAt.getTime() > RING_MS + 15_000;
    if (ringingTooLong) {
      await expireStale(ctx);
      return null;
    }
    return view(ctx, row);
  });
}

const signal = z.object({ kind: z.enum(["offer", "answer", "ice", "restart"]), payload: z.string().max(20_000) });
export const callAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), kind: z.enum(["audio", "video"]) }),
  z.object({ action: z.enum(["ringing", "accept", "decline", "end", "missed", "failed"]), id: z.uuid(), token: z.string().max(200).optional() }),
  z.object({ action: z.literal("signal"), id: z.uuid(), signals: z.array(signal).min(1).max(60) }),
]);
export type CallAction = z.infer<typeof callAction>;
export type CallResult = { ok: true; call: CallView | null; glare?: boolean } | { ok: false; error: string; call?: CallView | null };

export function applyCall(ctx: Ctx, a: CallAction): Promise<CallResult> {
  return withSchema(async () => {
    const db = await getDb();
    const now = new Date();
    const partner = ctx.partners[0];

    if (a.action === "start") {
      if (!partner) return { ok: false, error: "There's nobody to call yet." };
      await expireStale(ctx);
      let existing = await live(ctx);
      if (!existing) {
        try {
          const [created] = await db
            .insert(calls)
            .values({ relationshipId: ctx.relationship.id, callerId: ctx.me.id, calleeId: partner.id, kind: a.kind, pushedAt: new Date(), pushCount: 1 })
            .returning();
          ringByPush(ctx, created);
          return { ok: true, call: view(ctx, created) };
        } catch {
          // Both of you pressed call in the same instant: the unique index let one through.
          existing = await live(ctx);
          if (!existing) return { ok: false, error: "Couldn't start the call. Try again." };
        }
      }
      if (existing.callerId === ctx.me.id && existing.status !== "active") return { ok: true, call: view(ctx, existing) };
      if (existing.calleeId === ctx.me.id && existing.status !== "active") return { ok: true, call: view(ctx, existing), glare: true };
      return { ok: false, error: "You're already in a call.", call: view(ctx, existing) };
    }

    const row = await mine(ctx, a.id);
    if (!row) return { ok: false, error: "That call has ended." };
    const isCallee = row.calleeId === ctx.me.id;

    switch (a.action) {
      case "ringing": {
        if (isCallee) await db.update(calls).set({ status: "ringing", calleeSeenAt: now }).where(and(eq(calls.id, row.id), eq(calls.status, "calling")));
        break;
      }
      case "accept": {
        if (!isCallee) return { ok: false, error: "Only the person being called can answer." };
        const [updated] = await db
          .update(calls)
          .set({ status: "active", answeredAt: now, calleeSeenAt: now })
          .where(and(eq(calls.id, row.id), inArray(calls.status, ["calling", "ringing"])))
          .returning();
        if (!updated) return { ok: false, error: "This call has already ended.", call: view(ctx, (await mine(ctx, row.id)) ?? row) };
        after(async () => {
          // Stop the ringing on my other devices.
          const { pushTo } = await import("@/lib/push/server");
          const caller = ctx.members.find((m) => m.id === row.callerId)?.displayName.split(" ")[0] ?? "Our Universe";
          await pushTo([ctx.me.id], { type: "call-end", callId: row.id, reason: "answered", title: caller, kind: row.kind === "video" ? "video" : "audio" }, { ttl: 60, urgency: "high" }).catch(() => 0);
        });
        break;
      }
      case "decline":
        await finish(ctx, row.id, ["calling", "ringing"], "declined", ctx.me.id);
        break;
      case "missed":
        await finish(ctx, row.id, ["calling", "ringing"], "missed", null);
        break;
      case "failed":
        await finish(ctx, row.id, LIVE, "failed", ctx.me.id);
        break;
      case "end":
        // Hanging up before an answer is a cancel (caller) or a decline (callee).
        if (row.status === "active") await finish(ctx, row.id, ["active"], "ended", ctx.me.id);
        else await finish(ctx, row.id, ["calling", "ringing"], isCallee ? "declined" : "missed", ctx.me.id);
        break;
      case "signal":
        await db.insert(callSignals).values(a.signals.map((s) => ({ callId: row.id, fromId: ctx.me.id, kind: s.kind, payload: s.payload })));
        break;
    }
    const fresh = await mine(ctx, row.id);
    return { ok: true, call: fresh ? view(ctx, fresh) : null };
  });
}

/** Polled during a call: its status, and handshake messages from the other phone after `after`. */
export function syncCall(ctx: Ctx, id: string, afterId: number): Promise<CallSync | null> {
  return withSchema(async () => {
    const db = await getDb();
    const row = await mine(ctx, id);
    if (!row) return null;
    const now = new Date();
    if (LIVE.includes(row.status)) {
      await db
        .update(calls)
        .set(row.callerId === ctx.me.id ? { callerSeenAt: now } : { calleeSeenAt: now })
        .where(eq(calls.id, row.id));
      if (row.status !== "active" && now.getTime() - row.createdAt.getTime() > RING_MS + 15_000) await finish(ctx, row.id, ["calling", "ringing"], "missed", null);
      // No open page has picked the call up yet: ring their phones again (at most once per interval, however many polls arrive).
      if (row.status === "calling" && row.callerId === ctx.me.id && now.getTime() - row.createdAt.getTime() < RING_MS) {
        const [due] = await db
          .update(calls)
          .set({ pushedAt: now, pushCount: sql`${calls.pushCount} + 1` })
          .where(and(eq(calls.id, row.id), eq(calls.status, "calling"), lt(calls.pushCount, MAX_PUSHES), or(isNull(calls.pushedAt), lt(calls.pushedAt, new Date(now.getTime() - REPUSH_MS)))))
          .returning();
        if (due) ringByPush(ctx, due);
      }
    }
    const signals = await db
      .select({ id: callSignals.id, kind: callSignals.kind, payload: callSignals.payload })
      .from(callSignals)
      .where(and(eq(callSignals.callId, row.id), ne(callSignals.fromId, ctx.me.id), gt(callSignals.id, afterId)))
      .orderBy(callSignals.id)
      .limit(200);
    const fresh = (await mine(ctx, row.id)) ?? row;
    return { serverNow: now.toISOString(), call: view(ctx, fresh), signals: signals.map((s) => ({ id: s.id, kind: s.kind as "offer", payload: s.payload })) };
  });
}

/** "Decline" tapped on a notification on a signed-out device: allowed with the call's own signed token. */
export async function declineWithToken(id: string, token: string): Promise<CallResult> {
  return withSchema(async () => {
    const db = await getDb();
    const [row] = await db.select().from(calls).where(eq(calls.id, id));
    if (!row || !verifySignature(`call-decline:${row.id}:${row.calleeId}`, token)) return { ok: false, error: "Not allowed" };
    const ctx = await ctxFor(row.calleeId);
    if (!ctx) return { ok: false, error: "Not allowed" };
    await finish(ctx, row.id, ["calling", "ringing"], "declined", row.calleeId);
    return { ok: true, call: null };
  });
}
