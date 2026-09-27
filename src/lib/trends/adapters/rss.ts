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
  return typeof alt === "string" ? alt : (alt["@_href"] as string) ?? null;
}

function image(item: Node): string | null {
  for (const key of ["media:thumbnail", "media:content", "enclosure"]) {
    for (const m of arr(item[key] as Node | Node[])) {
      const url = m?.["@_url"] as string | undefined;
      const type = (m?.["@_type"] as string | undefined) ?? "";
      const medium = (m?.["@_medium"] as string | undefined) ?? "";
      if (url && (key !== "enclosure" || type.startsWith("image/")) && (key !== "media:content" || !medium || medium === "image")) {
        return url;
      }
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
    const url = feed ? atomLink(it) : text(it.link) ?? text(it.guid);
    const published = date(it.pubDate, it["dc:date"], it.published, it.updated);
    // No date means we cannot say how fresh it is, so we don't show it.
    if (!title || !url || !published) continue;
    if (now - published.getTime() > MAX_AGE_MS) continue;
    const updated = date(it.updated, it["atom:updated"]);
    const rawSummary = text(it.description) ?? text(it.summary) ?? text(it["content:encoded"]) ?? text(it.content);
    const author = text(it["dc:creator"]) ?? text((it.author as Node | undefined)?.name) ?? text(it.author);
    const categories = arr(it.category as unknown[]).map((c) => (typeof c === "object" ? ((c as Node)["@_term"] as string) ?? text(c) : text(c))).filter(Boolean);
    items.push({
      title: stripHtml(decodeEntities(title)),
      summary: excerpt(rawSummary),
      author: author ? stripHtml(author).slice(0, 120) : null,
      url: url.trim(),
      // A feed can carry a future timestamp; never present something as newer than now.
      publishedAt: new Date(Math.min(published.getTime(), now)),
      sourceUpdatedAt: updated && updated.getTime() !== published.getTime() ? updated : null,
      imageUrl: source.thumbnails ? image(it) : null,
      imageCredit: source.thumbnails ? source.name : null,
      imageLicense: source.thumbnails ? (source.key === "nasa-eo" ? "Public domain (NASA)" : null) : null,
      contentType: source.topic === "philosophy" ? (source.key === "sep" ? "encyclopedia" : "essay") : source.key === "nature-biotech" ? "paper" : "article",
      extra: null,
      ruleHints: categories.join(" "),
    });
  }
  return { status: "ok", items, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
}
