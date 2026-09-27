"use server";

import { requireCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { dailyAnswers, roomEvents } from "@/lib/db/schema";
import { nairobiDay } from "@/lib/together/questions";

const MESSAGES: Record<string, string> = {
  nudge: "is thinking of you ❤️",
  invite: "wants to listen or watch together — come to the Together room 🎧",
  hug: "sent you a hug 🤗",
  kiss: "sent you a kiss 😘",
  miss: "misses you 🥺",
};

/** A tiny gesture that pops up on the other person's screen within seconds. */
export async function sendNudge(kind: string): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  const body = MESSAGES[kind];
  if (!body) return { ok: false };
  const db = await getDb();
  await db.insert(roomEvents).values({ relationshipId: ctx.relationship.id, personId: ctx.me.id, kind: kind === "invite" ? "invite" : "nudge", body });
  return { ok: true };
}

/** Answer (or edit my answer to) today's question. */
export async function answerToday(_: unknown, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireCtx();
  const answer = String(fd.get("answer") ?? "").trim().slice(0, 1500);
  if (!answer) return { error: "Write something first" };
  const day = nairobiDay(new Date());
  const db = await getDb();
  await db
    .insert(dailyAnswers)
    .values({ relationshipId: ctx.relationship.id, day, personId: ctx.me.id, answer })
    .onConflictDoUpdate({ target: [dailyAnswers.relationshipId, dailyAnswers.day, dailyAnswers.personId], set: { answer, createdAt: new Date() } });
  await db.insert(roomEvents).values({ relationshipId: ctx.relationship.id, personId: ctx.me.id, kind: "system", body: "answered today's question — your turn 💌" });
  revalidatePath("/");
  return { ok: true };
}
