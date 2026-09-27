import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { bridgeFeed, forYouFeed, randomTrend, savedFeed, topicFeed, type FeedPage } from "@/lib/trends/query";
import { refreshIfStale } from "@/lib/trends/refresh";
import { isTopicKey } from "@/lib/trends/topics";

export const maxDuration = 60;

/**
 * GET /api/trends?feed=topic&topic=birds&category=Migration&cursor=…
 *     feed = topic | for-you | together | saved | random
 * Reads only from the database: external sources are never called on a page load.
 */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const feed = p.get("feed") ?? "topic";
  const cursor = p.get("cursor");
  const as = ctx.members.find((m) => m.slug === p.get("as")) ?? ctx.me;

  let page: FeedPage;
  try {
    if (feed === "random") {
      const topic = p.get("topic") ?? "";
      if (!isTopicKey(topic)) return NextResponse.json({ error: "Unknown topic" }, { status: 400 });
      const ex = p.get("exclude");
      const item = await randomTrend(topic, ex && /^[0-9a-f-]{36}$/i.test(ex) ? ex : null);
      return NextResponse.json({ items: item ? [item] : [], nextCursor: null }, { headers: { "Cache-Control": "no-store" } });
    }
    if (feed === "for-you") page = await forYouFeed({ personId: as.id, cursor });
    else if (feed === "together") page = await bridgeFeed({ cursor, personId: ctx.me.id });
    else if (feed === "saved") page = await savedFeed({ personId: ctx.me.id, kind: p.get("kind"), cursor });
    else {
      const topic = p.get("topic") ?? "";
      if (!isTopicKey(topic)) return NextResponse.json({ error: "Unknown topic" }, { status: 400 });
      page = await topicFeed({ topic, category: p.get("category"), cursor, personId: ctx.me.id });
    }
  } catch (e) {
    console.error("[trends] feed query failed", e);
    return NextResponse.json({ error: "Feed unavailable" }, { status: 503 });
  }

  await refreshIfStale();
  return NextResponse.json(page, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } });
}
