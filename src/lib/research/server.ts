import "server-only";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/context";
import { getDb, withSchema } from "@/lib/db/client";
import { researchMessages, researchThreads, sharedLearning, type ResearchSource } from "@/lib/db/schema";
import { personTopics } from "@/lib/trends/query";
import { TOPICS } from "@/lib/trends/topics";
import { GeminiError, generateJson, openStream, textOf, type Content, type Grounding } from "./gemini";
import { findStudies, type Study } from "./studies";
import type { Quiz, ResearchMessage, ResearchMode, StreamEvent, ThreadSummary, ThreadView } from "./types";

type ThreadRow = typeof researchThreads.$inferSelect;
type MessageRow = typeof researchMessages.$inferSelect;

const FOLLOW = "FOLLOW-UPS:";

function summary(ctx: Ctx, t: ThreadRow): ThreadSummary {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode as ResearchMode,
    shared: t.shared,
    mine: t.ownerId === ctx.me.id,
    ownerSlug: ctx.members.find((m) => m.id === t.ownerId)?.slug ?? "",
    updatedAt: t.updatedAt.toISOString(),
  };
}

function message(m: MessageRow): ResearchMessage {
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "model",
    content: m.content,
    sources: m.sources ?? [],
    queries: m.queries ?? [],
    followUps: m.followUps ?? [],
    searchWidget: m.searchWidget,
    model: m.model,
    grounded: m.grounded,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Mine, plus the ones my partner shared with me. */
const visible = (ctx: Ctx) => and(eq(researchThreads.relationshipId, ctx.relationship.id), or(eq(researchThreads.ownerId, ctx.me.id), eq(researchThreads.shared, true)));

export function listThreads(ctx: Ctx): Promise<ThreadSummary[]> {
  return withSchema(async () => {
    const db = await getDb();
    const rows = await db.select().from(researchThreads).where(visible(ctx)).orderBy(desc(researchThreads.updatedAt)).limit(100);
    return rows.map((t) => summary(ctx, t));
  });
}

async function thread(ctx: Ctx, id: string): Promise<ThreadRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(researchThreads).where(and(eq(researchThreads.id, id), visible(ctx)));
  return row ?? null;
}

export function getThread(ctx: Ctx, id: string): Promise<ThreadView | null> {
  return withSchema(async () => {
    const t = await thread(ctx, id);
    if (!t) return null;
    const db = await getDb();
    const rows = await db.select().from(researchMessages).where(eq(researchMessages.threadId, t.id)).orderBy(asc(researchMessages.id));
    return { ...summary(ctx, t), messages: rows.map(message) };
  });
}

export async function updateThread(ctx: Ctx, id: string, patch: { shared?: boolean; title?: string }): Promise<boolean> {
  return withSchema(async () => {
    const db = await getDb();
    const res = await db
      .update(researchThreads)
      .set({ ...(patch.shared !== undefined ? { shared: patch.shared } : {}), ...(patch.title ? { title: patch.title.slice(0, 120) } : {}) })
      .where(and(eq(researchThreads.id, id), eq(researchThreads.ownerId, ctx.me.id)))
      .returning({ id: researchThreads.id });
    return res.length > 0;
  });
}

export async function deleteThread(ctx: Ctx, id: string): Promise<boolean> {
  return withSchema(async () => {
    const db = await getDb();
    const res = await db
      .delete(researchThreads)
      .where(and(eq(researchThreads.id, id), eq(researchThreads.ownerId, ctx.me.id)))
      .returning({ id: researchThreads.id });
    return res.length > 0;
  });
}

// ─── Asking ───────────────────────────────────────────────────────────────

const GUIDES: Record<ResearchMode, string> = {
  research: `You are a meticulous research companion. Answer from evidence.
- When studies are provided, rely on them first and cite them inline as [1], [2] using their numbers. Only cite numbers you were given.
- Never invent studies, authors, statistics or quotations. If the evidence is thin, early, mixed or only in animals, say so plainly.
- Prefer systematic reviews and large, well-designed studies; mention design and sample size when the abstract states them.
Format in Markdown:
1. Open with a clear two-to-three sentence answer (no heading).
2. "## Key findings" — 3–6 bullets: what was found, by whom and when, with citations.
3. "## What it means" — practical takeaways.
4. "## Limits and open questions" — what we still don't know.
Keep it under about 450 words unless asked to go deeper.`,
  learn: `You are a patient, brilliant tutor. Teach so it sticks.
- Build intuition before detail. Use one vivid analogy and one concrete worked example.
- Define any term the first time you use it.
- When studies are provided, you may cite them as [1], [2]; never invent sources.
Format in Markdown:
1. "## The big idea" — the core idea in plain words.
2. "## Step by step" — a numbered walk-through.
3. "## An example" — worked through.
4. "## Check yourself" — two short questions, each followed on the next line by its answer in italics.
Keep it under about 550 words.`,
  explain: `You explain things simply to a bright friend with no background in the subject.
- Use short sentences, everyday words and one good analogy. No jargon unless you define it.
- When studies are provided, you may cite them as [1], [2]; never invent sources.
Keep it under about 220 words, in Markdown, with no headings.`,
};

async function systemFor(ctx: Ctx, mode: ResearchMode): Promise<string> {
  const topics = (await personTopics(ctx.me.id).catch(() => [])).map((t) => TOPICS[t]?.label).filter(Boolean);
  const first = ctx.me.displayName.split(" ")[0];
  return [
    `You are part of "Our Universe", a private site shared by ${ctx.members.map((m) => m.displayName.split(" ")[0]).join(" and ")}. You are helping ${first}.${topics.length ? ` Their interests include ${topics.join(", ")}: draw an example from one only when it fits the question naturally; most answers shouldn't mention them.` : ""}`,
    GUIDES[mode],
    "Write in warm, precise British English. Cite only the numbered studies you are given; if none are given, use no [n] citations. Never add a references or sources list: the page shows the sources itself.",
    `For context only (don't mention it unless the question is about time): today is ${new Date().toISOString().slice(0, 10)}.`,
    `After your answer, end with exactly one final line: "${FOLLOW} <question 1> | <question 2> | <question 3>" — three natural follow-up questions ${first} might ask next.`,
  ].join("\n\n");
}

function studyBlock(studies: Study[], mode: ResearchMode): string {
  if (!studies.length) return mode === "research" ? "\n\n(No studies were found in the scholarly index for this question. Answer from well-established knowledge, say plainly that you couldn't check specific studies, and use no [n] citations.)" : "";
  return (
    "\n\nStudies found in the scholarly index for this question (cite as [n] only when you use one):\n" +
    studies
      .map((s) => `[${s.n}] ${s.title} (${s.year ?? "n.d."}). ${s.authors || "Unknown authors"}. ${s.venue ?? ""}${s.citations ? ` Cited ${s.citations} times.` : ""}\nAbstract: ${s.abstract}`)
      .join("\n\n")
  );
}

const domainOf = (uri: string, fallback = "") => {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
};

/** Splits the trailing "FOLLOW-UPS: a | b | c" line off an answer. */
export function splitFollowUps(text: string): { body: string; followUps: string[] } {
  const idx = text.toUpperCase().lastIndexOf(FOLLOW);
  if (idx < 0) return { body: text.trim(), followUps: [] };
  // Usually "a | b | c", but a model sometimes lists them on lines of their own.
  const followUps = text
    .slice(idx + FOLLOW.length)
    .split(/\||\n+/)
    .map((q) => q.replace(/^[\s"“*_•-]+|^\d+[.)]\s*|[\s"”*_]+$/g, "").trim())
    .filter((q) => q.length > 3)
    .slice(0, 3);
  return { body: text.slice(0, idx).replace(/[\s*_#>-]+$/, "").trim(), followUps };
}

/**
 * The part of a growing answer that's safe to show: everything except the
 * follow-up line, holding back a last line that might still turn into it.
 */
export function showable(full: string): string {
  const upper = full.toUpperCase();
  const idx = upper.lastIndexOf(FOLLOW);
  if (idx >= 0) return full.slice(0, full.lastIndexOf("\n", idx) + 1);
  const lastBreak = full.lastIndexOf("\n");
  // Markdown the model may wrap the line in (**, _, #, >, -) doesn't count.
  const tail = upper.slice(lastBreak + 1).replace(/^[\s*_#>-]+/, "");
  return tail.length && FOLLOW.startsWith(tail.slice(0, FOLLOW.length)) ? full.slice(0, lastBreak + 1) : full;
}

export const askSchema = z.object({
  threadId: z.uuid().nullish(),
  question: z.string().trim().min(2).max(2000),
  mode: z.enum(["research", "learn", "explain"]).default("research"),
});

const recent = new Map<string, number[]>();
/** A gentle brake so a stuck button can't burn the whole free quota. */
function allowed(personId: string): boolean {
  const now = Date.now();
  const list = (recent.get(personId) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 30) return false;
  list.push(now);
  recent.set(personId, list);
  return true;
}

/**
 * Answers a question as a stream of events: the thread, progress, the studies
 * found, the answer as it's written, and finally the saved message.
 */
export async function* ask(ctx: Ctx, input: z.infer<typeof askSchema>): AsyncGenerator<StreamEvent> {
  if (!allowed(ctx.me.id)) {
    yield { t: "error", message: "That's a lot of questions in a few minutes. Take a breath and try again shortly." };
    return;
  }
  const db = await getDb();
  let t: ThreadRow | null = input.threadId ? await withSchema(() => thread(ctx, input.threadId!)) : null;
  if (input.threadId && !t) {
    yield { t: "error", message: "That research thread is gone." };
    return;
  }
  const mode: ResearchMode = input.mode;
  const created = !t;
  t ??= await withSchema(async () => (await db.insert(researchThreads).values({ relationshipId: ctx.relationship.id, ownerId: ctx.me.id, title: input.question.replace(/\s+/g, " ").slice(0, 100), mode }).returning())[0]);
  yield { t: "thread", thread: summary(ctx, t) };

  const [question] = await db.insert(researchMessages).values({ threadId: t.id, role: "user", content: input.question }).returning();
  let answered = false;
  try {
    const history = await db.select().from(researchMessages).where(eq(researchMessages.threadId, t.id)).orderBy(desc(researchMessages.id)).limit(9);
    const past = history.reverse().filter((m) => m.id !== question.id);

    let studies: Study[] = [];
    if (mode !== "explain") {
      yield { t: "status", text: "Searching the scholarly literature…" };
      studies = await findStudies(input.question, mode === "research" ? 6 : 4);
      if (studies.length) yield { t: "studies", items: studies.map(studySource) };
    }

    const contents: Content[] = [...past.map((m) => ({ role: (m.role === "user" ? "user" : "model") as Content["role"], parts: [{ text: m.content }] })), { role: "user", parts: [{ text: input.question + studyBlock(studies, mode) }] }];

    let full = "";
    let sent = 0;
    let grounding: Grounding | undefined;
    let model = "";
    let grounded = false;
    try {
      yield { t: "status", text: studies.length ? `Reading ${studies.length} ${studies.length === 1 ? "study" : "studies"}…` : "Thinking…" };
      const { attempt, events } = await openStream({ system: await systemFor(ctx, mode), contents, ground: mode === "research", maxTokens: mode === "explain" ? 1200 : 4096 });
      model = attempt.model;
      grounded = attempt.grounded;
      yield { t: "status", text: "Writing…" };
      for await (const chunk of events) {
        if (chunk.promptFeedback?.blockReason) throw new GeminiError("Gemini declined to answer that question.", "blocked");
        full += textOf(chunk);
        const cand = chunk.candidates?.[0];
        if (cand?.groundingMetadata) grounding = cand.groundingMetadata;
        const safe = showable(full);
        if (safe.length > sent) {
          yield { t: "delta", text: safe.slice(sent) };
          sent = safe.length;
        }
      }
      if (!full.trim()) throw new GeminiError("Gemini returned an empty answer. Try asking again.", "failed");
    } catch (e) {
      // Nothing useful came back (the finally below tidies the question away). A cut-off answer is still kept.
      if (!full.trim()) {
        yield { t: "error", message: e instanceof GeminiError ? e.message : "Research couldn't finish. Try again.", retry: true };
        return;
      }
    }

    const { body, followUps } = splitFollowUps(full);
    const web: ResearchSource[] = (grounding?.groundingChunks ?? [])
      .map((c) => c.web)
      .filter((w): w is { uri: string; title?: string } => !!w?.uri)
      .map((w) => ({ kind: "web" as const, title: w.title ?? domainOf(w.uri), uri: w.uri, domain: w.title && /\./.test(w.title) ? w.title : domainOf(w.uri) }));
    const uniqueWeb = web.filter((w, i) => web.findIndex((x) => x.uri === w.uri) === i).slice(0, 10);
    const [saved] = await db
      .insert(researchMessages)
      .values({
        threadId: t.id,
        role: "model",
        content: body,
        sources: [...studies.map(studySource), ...uniqueWeb],
        queries: grounding?.webSearchQueries ?? [],
        followUps,
        searchWidget: grounding?.searchEntryPoint?.renderedContent ?? null,
        model,
        grounded: grounded && !!grounding,
      })
      .returning();
    answered = true;
    await db.update(researchThreads).set({ updatedAt: new Date() }).where(eq(researchThreads.id, t.id));
    yield { t: "done", message: message(saved) };
  } finally {
    // Failed, or the page was closed mid-answer: leave no unanswered question (or empty new thread) behind.
    if (!answered) {
      await db.delete(researchMessages).where(eq(researchMessages.id, question.id)).catch(() => {});
      if (created) await db.delete(researchThreads).where(eq(researchThreads.id, t.id)).catch(() => {});
    }
  }
}

function studySource(s: Study): ResearchSource {
  return { kind: "study", n: s.n, title: s.title, uri: s.url, domain: s.venue ?? domainOf(s.url, "study"), year: s.year, authors: s.authors, venue: s.venue, citations: s.citations };
}

// ─── Learning tools ───────────────────────────────────────────────────────

const QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answer: { type: "INTEGER" },
          explanation: { type: "STRING" },
        },
        required: ["question", "options", "answer", "explanation"],
      },
    },
  },
  required: ["questions"],
};

/** Five multiple-choice questions on what the thread covered, to check understanding. */
export async function quizFor(ctx: Ctx, id: string): Promise<Quiz | null> {
  const view = await getThread(ctx, id);
  if (!view) return null;
  const material = view.messages
    .filter((m) => m.role === "model")
    .slice(-3)
    .map((m) => m.content)
    .join("\n\n---\n\n")
    .slice(0, 12_000);
  const quiz = await generateJson<Quiz>({
    system: "You write short, fair multiple-choice quizzes that test real understanding, not trivia. Each question has exactly four options and one correct answer (0-based index). Explanations are one or two sentences.",
    prompt: `Write 5 questions on this material about "${view.title}":\n\n${material}`,
    schema: QUIZ_SCHEMA,
  });
  const questions = (quiz.questions ?? []).filter((q) => q.options?.length === 4 && q.answer >= 0 && q.answer < 4).slice(0, 5);
  return questions.length ? { questions } : null;
}

/** Keeps an answer in "Things we are learning", shared by both of you. */
export async function saveToLearning(ctx: Ctx, id: string, messageId: number): Promise<boolean> {
  return withSchema(async () => {
    const t = await thread(ctx, id);
    if (!t) return false;
    const db = await getDb();
    const [m] = await db.select().from(researchMessages).where(and(eq(researchMessages.id, messageId), eq(researchMessages.threadId, t.id)));
    if (!m || m.role !== "model") return false;
    const plain = m.content
      .replace(/\[(\d+)\]/g, "")
      .replace(/[#*_>`]/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    const top = (m.sources ?? [])[0];
    await db.insert(sharedLearning).values({
      relationshipId: ctx.relationship.id,
      addedBy: ctx.me.id,
      title: t.title,
      topic: t.mode === "learn" ? "Lesson" : t.mode === "explain" ? "Explained" : "Research",
      notes: plain.slice(0, 1200),
      source: top ? (top.kind === "study" ? `${top.title}${top.year ? ` (${top.year})` : ""}` : top.domain) : "Our Universe research",
      url: top?.uri ?? null,
      occurredOn: new Date().toISOString().slice(0, 10),
    });
    return true;
  });
}
