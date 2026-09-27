import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { trends } from "@/lib/db/schema";
import { USER_AGENT, decodeEntities } from "./adapters/types";

/**
 * The article's own preview image: the og:image / twitter:image that link
 * previews (WhatsApp, Slack, iMessage) show. Read from the first part of the
 * page only; nothing else is taken from the article.
 */
export async function previewImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok || !res.body) return null;
    // Stop after ~250 KB: the <head> is all we need.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 250_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
      if (new TextDecoder().decode(value).includes("</head>")) break;
    }
    reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
    const found = meta("og:image:secure_url") ?? meta("og:image") ?? meta("twitter:image") ?? meta("twitter:image:src");
    if (!found) return null;
    const abs = new URL(decodeEntities(found), res.url || pageUrl).toString();
    return /^https:\/\//.test(abs) && !/\.svg(\?|$)/i.test(abs) ? abs : null;
  } catch {
    return null;
  }
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/**
 * Gives picture-less items their article preview image. Runs a small batch
 * after every ingest, so older items fill in over a few runs without ever
 * making one run slow. Items that have no preview image are marked so they
 * aren't retried forever.
 */
export async function enrichMissingImages(limit = 30, deadline = Infinity): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: trends.id, url: trends.sourceUrl, extra: trends.extra, sourceName: trends.sourceName })
    .from(trends)
    .where(and(isNull(trends.imageUrl), sql`coalesce(${trends.extra}->>'imageOrigin', '') <> 'none'`))
    .orderBy(sql`${trends.publishedAt} desc`)
    .limit(limit);
  let found = 0;
  await pool(rows, 4, async (r) => {
    if (Date.now() > deadline) return;
    const img = await previewImage(r.url);
    await db
      .update(trends)
      .set(
        img
          ? { imageUrl: img, imageCredit: r.sourceName, extra: { ...(r.extra ?? {}), imageOrigin: "preview" } }
          : { extra: { ...(r.extra ?? {}), imageOrigin: "none" } },
      )
      .where(eq(trends.id, r.id));
    if (img) found++;
  });
  return found;
}
