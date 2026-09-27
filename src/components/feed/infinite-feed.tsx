"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedHealth, FeedPage, TrendCard } from "@/lib/trends/query";
import { TOPICS, type TopicKey } from "@/lib/trends/topics";
import { ago } from "@/lib/ui/time";
import { TrendCardView } from "./trend-card";

export type FeedParams = { feed: "topic" | "for-you" | "together" | "saved"; topic?: TopicKey; category?: string | null; kind?: string | null; as?: string };

async function fetchPage(params: FeedParams, cursor: string | null): Promise<FeedPage> {
  const qs = new URLSearchParams({ feed: params.feed });
  if (params.topic) qs.set("topic", params.topic);
  if (params.category) qs.set("category", params.category);
  if (params.kind) qs.set("kind", params.kind);
  if (params.as) qs.set("as", params.as);
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/api/trends?${qs}`);
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return res.json();
}

/**
 * Honest freshness: "Live" only when the topic's sources publish through the
 * day AND we refreshed recently AND something new arrived in the last day.
 * Otherwise we say how often it updates and when it was last checked.
 */
function FreshnessBadge({ health, topics }: { health: FeedHealth; topics: TopicKey[] }) {
  // Captured once per mount so the badge is stable across re-renders.
  const [now] = useState(() => Date.now());
  const recentCheck = health.lastRefreshedAt && now - new Date(health.lastRefreshedAt).getTime() < 2 * 3600_000;
  const recentItem = health.newestPublishedAt && now - new Date(health.newestPublishedAt).getTime() < 24 * 3600_000;
  const allLive = topics.every((t) => TOPICS[t].cadence === "live");
  const live = allLive && recentCheck && recentItem;
  const cadence = topics.some((t) => TOPICS[t].cadence === "daily") ? "daily" : topics.some((t) => TOPICS[t].cadence === "weekly") ? "weekly" : "through the day";
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted" suppressHydrationWarning>
      {live ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      ) : (
        <span className="font-semibold">Sources update {cadence}</span>
      )}
      {health.lastRefreshedAt && <span>Checked {ago(health.lastRefreshedAt)}</span>}
      {health.newestPublishedAt && <span>Newest item {ago(health.newestPublishedAt)}</span>}
    </p>
  );
}

function Skeleton() {
  return (
    <div className="card animate-pulse overflow-hidden" aria-hidden>
      <div className="aspect-[16/7] bg-surface-2" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-24 rounded bg-surface-2" />
        <div className="h-5 w-11/12 rounded bg-surface-2" />
        <div className="h-3 w-full rounded bg-surface-2" />
        <div className="h-3 w-2/3 rounded bg-surface-2" />
      </div>
    </div>
  );
}

export function InfiniteFeed({ params, topics, empty }: { params: FeedParams; topics: TopicKey[]; empty?: React.ReactNode }) {
  const q = useInfiniteQuery({
    queryKey: ["feed", params],
    queryFn: ({ pageParam }) => fetchPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  // Pages can overlap if new items arrive between requests; show each item once.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: TrendCard[] = [];
    for (const p of q.data?.pages ?? []) for (const it of p.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }, [q.data]);

  const health = q.data?.pages[0]?.health;
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <section aria-busy={q.isFetching} aria-live="polite">
      {health && <FreshnessBadge health={health} topics={topics} />}
      {(health?.degraded || (q.isError && items.length > 0)) && (
        <div role="status" className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          Some discoveries are temporarily unavailable. Your saved content is still here.
          {health && health.failingSources.length > 0 && <span className="block text-xs opacity-80">Waiting on: {health.failingSources.join(", ")} — we&apos;ll retry automatically.</span>}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <TrendCardView key={it.id} item={it} />
        ))}
        {(q.isPending || isFetchingNextPage) && Array.from({ length: q.isPending ? 6 : 3 }, (_, i) => <Skeleton key={i} />)}
      </div>

      {q.isError && items.length === 0 && (
        <div className="card mt-4 p-6 text-center">
          <p>Some discoveries are temporarily unavailable. Your saved content is still here.</p>
          <button className="btn mt-3" onClick={() => q.refetch()}>
            Try again
          </button>
        </div>
      )}
      {q.isSuccess && items.length === 0 && (empty ?? <p className="card mt-4 p-6 text-center text-muted">Nothing here yet — new discoveries arrive as sources publish.</p>)}

      <div ref={sentinel} className="h-px" />
      {q.isSuccess && !hasNextPage && items.length > 0 && <p className="py-10 text-center text-sm text-muted">You&apos;ve reached the edge of this universe — for now. New discoveries arrive through the day.</p>}
      {q.isError && items.length > 0 && hasNextPage && (
        <div className="py-6 text-center">
          <button className="btn btn-ghost" onClick={() => fetchNextPage()}>
            Load more
          </button>
        </div>
      )}
    </section>
  );
}
