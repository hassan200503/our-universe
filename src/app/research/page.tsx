import { requireCtx } from "@/lib/context";
import { geminiKey } from "@/lib/research/gemini";
import { getThread, listThreads } from "@/lib/research/server";
import { suggestionsFor } from "@/lib/research/suggest";
import type { ResearchMode } from "@/lib/research/types";
import { personTopics } from "@/lib/trends/query";
import { ResearchApp } from "@/components/research/research-app";

export const metadata = { title: "Research" };

const MODES: ResearchMode[] = ["research", "learn", "explain"];

export default async function ResearchPage({ searchParams }: PageProps<"/research">) {
  const ctx = await requireCtx();
  const { t, q, mode } = await searchParams;
  const threadId = typeof t === "string" && /^[0-9a-f-]{36}$/i.test(t) ? t : null;
  const question = typeof q === "string" ? q.trim().slice(0, 2000) : "";
  const askMode = typeof mode === "string" && MODES.includes(mode as ResearchMode) ? (mode as ResearchMode) : "research";

  const [threads, thread, key, topics] = await Promise.all([
    listThreads(ctx).catch(() => []),
    threadId && !question ? getThread(ctx, threadId).catch(() => null) : Promise.resolve(null),
    geminiKey().catch(() => null),
    personTopics(ctx.me.id).catch(() => []),
  ]);

  return (
    <ResearchApp
      initialThreads={threads}
      initialThread={thread}
      configured={!!key}
      suggestions={suggestionsFor(topics, `${ctx.me.slug}|${new Date().toISOString().slice(0, 10)}`)}
      people={ctx.members.map((m) => ({ slug: m.slug, first: m.displayName.split(" ")[0], theme: m.theme }))}
      meFirst={ctx.me.displayName.split(" ")[0]}
      autoAsk={question.length >= 2 ? { q: question, mode: askMode } : null}
    />
  );
}
