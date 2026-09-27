import { XMLParser } from "fast-xml-parser";
import type { RssSource } from "../sources";
import { type AdapterResult, type FetchState, type NormalizedItem, SourceError, decodeEntities, excerpt, fetchSource, stripHtml } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: false,
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

const arr = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function text(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") return text((v as Node)["#text"]);
  return null;
}

function date(...candidates: unknown[]): Date | null {
  for (const c of candidates) {
    const s = text(c);
    if (!s) continue;
    // "Thu Sep 24 00:00:00 UTC 2026" and friends parse fine; bare "2026-09-25" too.
    const d = new Date(s.replace(/ UTC /, " GMT "));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function atomLink(entry: Node): string | null {
  const links = arr(entry.link as Node | Node[]);
  const alt = links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate")) ?? links[0];
  if (!alt) return null;
  return typeof alt === "string" ? alt : ((alt["@_href"] as string) ?? null);
}

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

/** An image the publisher put in the feed: media tags, enclosures, or the first <img> in the content. */
function feedImage(item: Node, html: string | null): string | null {
  const group = item["media:group"] as Node | undefined;
  const candidates: Node[] = [
    ...arr(item["media:thumbnail"] as Node | Node[]),
    ...arr(group?.["media:thumbnail"] as Node | Node[]),
    ...arr(item["media:content"] as Node | Node[]),
    ...arr(group?.["media:content"] as Node | Node[]),
    ...arr(item.enclosure as Node | Node[]),
  ];
  for (const m of candidates) {
    const url = m?.["@_url"] as string | undefined;
    if (!url) continue;
    const type = String(m["@_type"] ?? "");
    const medium = String(m["@_medium"] ?? "");
    if (type.startsWith("image/") || medium === "image" || IMG_EXT.test(url) || (!type && !medium)) return url;
  }
  const itunes = (item["itunes:image"] as Node | undefined)?.["@_href"] as string | undefined;
  if (itunes) return itunes;
  if (html) {
    // Skip tracking pixels and emoji; prefer a real content image.
    for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
      const src = decodeEntities(m[1]);
      if (!/^https?:\/\//.test(src)) continue;
      if (/(pixel|feedburner|emoji|gravatar|wp-includes|\.svg)/i.test(src)) continue;
      const w = Number(m[0].match(/width=["']?(\d+)/i)?.[1] ?? 0);
      if (w && w < 80) continue;
      return src;
    }
  }
  return null;
}

const MAX_AGE_MS = 365 * 24 * 3600 * 1000;

export async function fetchRss(source: RssSource, state: FetchState): Promise<AdapterResult> {
  const res = await fetchSource(source.url, state, "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8");
  if (res === "not-modified") return { status: "not-modified" };
  const body = await res.text();
  if (/<html[\s>]/i.test(body.slice(0, 500)) && !/<(rss|feed|rdf)/i.test(body.slice(0, 2000))) {
    throw new SourceError("Source returned an HTML page instead of a feed (likely a bot challenge)", res.status);
  }
  let doc: Node;
  try {
    doc = parser.parse(body) as Node;
  } catch (e) {
    throw new SourceError(`Unparseable feed: ${String(e).slice(0, 120)}`);
  }

  const rss = doc.rss as Node | undefined;
  const channel = rss?.channel as Node | undefined;
  const rdf = doc["rdf:RDF"] as Node | undefined;
  const feed = doc.feed as Node | undefined;
  const rawItems: Node[] = channel ? arr(channel.item as Node[]) : rdf ? arr(rdf.item as Node[]) : feed ? arr(feed.entry as Node[]) : [];
  if (!channel && !rdf && !feed) throw new SourceError("Not an RSS or Atom document");

  const now = Date.now();
  const items: NormalizedItem[] = [];
  for (const it of rawItems) {
    const title = text(it.title);
    const url = feed ? atomLink(it) : (text(it.link) ?? text(it.guid));
    const published = date(it.pubDate, it["dc:date"], it.published, it.updated);
    // No date means we cannot say how fresh it is, so we don't show it.
    if (!title || !url || !published) continue;
    if (now - published.getTime() > MAX_AGE_MS) continue;
    if (source.include && !source.include.test(url)) continue;

    const youtubeId = text(it["yt:videoId"]);
    const group = it["media:group"] as Node | undefined;
    const html = text(it["content:encoded"]) ?? text(it.content) ?? text(it.description) ?? text(it.summary);
    const rawSummary = youtubeId ? text(group?.["media:description"]) : (text(it.description) ?? text(it.summary) ?? html);
    const cleanTitle = stripHtml(decodeEntities(title));
    const summary = excerpt(rawSummary);

    // Sources whose topic is broader than ours must mention it (ScienceDaily "Birds" also carries dinosaurs).
    if (source.requireKeywords && !source.requireKeywords.test(`${cleanTitle} ${summary ?? ""}`)) continue;

    const updated = date(it.updated, it["atom:updated"]);
    const authorNode = it.author as Node | undefined;
    const author = text(it["dc:creator"]) ?? text(authorNode?.name) ?? text(it.author);
    const categories = arr(it.category as unknown[])
      .map((c) => (typeof c === "object" ? (((c as Node)["@_term"] as string) ?? text(c)) : text(c)))
      .filter(Boolean);

    const image = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : feedImage(it, html);
    const isReddit = /reddit\.com/.test(source.url);
    items.push({
      title: cleanTitle,
      summary: isReddit ? null : summary,
      author: author ? stripHtml(author).replace(/^\/u\//, "u/").slice(0, 120) : null,
      url: url.trim(),
      // A feed can carry a future timestamp; never present something as newer than now.
      publishedAt: new Date(Math.min(published.getTime(), now)),
      sourceUpdatedAt: updated && updated.getTime() !== published.getTime() ? updated : null,
      imageUrl: image,
      imageCredit: image ? source.name : null,
      imageLicense: image ? (source.key === "nasa-eo" ? "Public domain (NASA)" : null) : null,
      contentType: youtubeId
        ? "video"
        : isReddit
          ? "community"
          : source.topic === "philosophy"
            ? source.key === "sep"
              ? "encyclopedia"
              : "essay"
            : source.key === "nature-biotech"
              ? "paper"
              : "article",
      extra: youtubeId ? { youtubeId, imageOrigin: "youtube" } : image ? { imageOrigin: "feed" } : null,
      ruleHints: `${youtubeId ? "video: " : isReddit ? "community: " : ""}${categories.join(" ")}`,
    });
  }
  return { status: "ok", items, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
}
