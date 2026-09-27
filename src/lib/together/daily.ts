import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import type { Ctx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { dailyAnswers } from "@/lib/db/schema";
import { nairobiDay, questionFor } from "./questions";

export type DailyQuestion = {
  day: string;
  question: string;
  mine: string | null;
  /** Partner answers, revealed only once I've answered. */
  theirs: { slug: string; answer: string }[];
  partnerAnswered: boolean;
};

export async function todaysQuestion(ctx: Ctx, now: Date): Promise<DailyQuestion> {
  const db = await getDb();
  const day = nairobiDay(now);
  const rows = await db
    .select()
    .from(dailyAnswers)
    .where(and(eq(dailyAnswers.relationshipId, ctx.relationship.id), eq(dailyAnswers.day, day)));
  const mine = rows.find((r) => r.personId === ctx.me.id)?.answer ?? null;
  const others = rows.filter((r) => r.personId !== ctx.me.id);
  return {
    day,
    question: questionFor(day),
    mine,
    partnerAnswered: others.length > 0,
    theirs: mine ? others.map((r) => ({ slug: ctx.members.find((m) => m.id === r.personId)?.slug ?? "", answer: r.answer })) : [],
  };
}

/** Past days where both of you answered: a little archive of conversations. */
export async function pastAnswers(ctx: Ctx, now: Date, limit = 30) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(dailyAnswers)
    .where(and(eq(dailyAnswers.relationshipId, ctx.relationship.id), lt(dailyAnswers.day, nairobiDay(now))))
    .orderBy(desc(dailyAnswers.day))
    .limit(limit * ctx.members.length);
  const byDay = new Map<string, { slug: string; answer: string }[]>();
  for (const r of rows) {
    const slug = ctx.members.find((m) => m.id === r.personId)?.slug ?? "";
    byDay.set(r.day, [...(byDay.get(r.day) ?? []), { slug, answer: r.answer }]);
  }
  return [...byDay.entries()].map(([day, answers]) => ({ day, question: questionFor(day), answers }));
}
