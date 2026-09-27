import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/context";
import { SOURCES } from "@/lib/trends/sources";
import { TOPICS, isTopicKey } from "@/lib/trends/topics";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { BirdSpotlight } from "@/components/feed/bird-spotlight";
import { Container, PageHeader } from "@/components/ui/page-header";

const WORLD: Record<string, string> = { software: "hassan", technology: "hassan", philosophy: "hassan", biotech: "whitney", birds: "whitney", knitting: "whitney", environment: "whitney", nature: "us" };

export async function generateMetadata({ params }: PageProps<"/discover/[topic]">) {
  const { topic } = await params;
  return { title: isTopicKey(topic) ? TOPICS[topic].label : "Discover" };
}

export default async function TopicPage({ params, searchParams }: PageProps<"/discover/[topic]">) {
  await requireCtx();
  const { topic } = await params;
  if (!isTopicKey(topic)) notFound();
  const { category } = await searchParams;
  const t = TOPICS[topic];
  const sources = SOURCES.filter((s) => s.topic === topic);
  const world = WORLD[topic];
  const cats = [...t.categories.map((c) => c.name), t.fallbackCategory];
  const cat = typeof category === "string" && cats.includes(category) ? category : null;
  return (
    <>
      <PageHeader world={world} eyebrow={topic === "nature" ? "Shared by both of us" : "Discovery feed"} title={<><span aria-hidden>{t.emoji}</span> {t.label}</>}>
        {t.blurb}
      </PageHeader>
      <Container world={world}>
        {topic === "birds" && <BirdSpotlight />}
        <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Link href={`/discover/${topic}`} className={`chip ${!cat ? "ring-1 ring-accent" : "bg-transparent text-muted"}`} aria-current={!cat ? "page" : undefined}>
            All
          </Link>
          {cats.map((c) => (
            <Link key={c} href={`/discover/${topic}?category=${encodeURIComponent(c)}`} className={`chip ${cat === c ? "ring-1 ring-accent" : "bg-transparent text-muted"}`} aria-current={cat === c ? "page" : undefined}>
              {c}
            </Link>
          ))}
        </nav>
        <div className="mt-5">
          <InfiniteFeed key={`${topic}:${cat}`} params={{ feed: "topic", topic, category: cat }} topics={[topic]} />
        </div>
        <details className="mt-8 text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-ink">Where this comes from ({sources.length} sources)</summary>
          <ul className="mt-2 space-y-1">
            {sources.map((s) => (
              <li key={s.key}>
                {s.name} <span className="text-xs">· checked every {s.every >= 60 ? `${s.every / 60}h` : `${s.every} min`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2">
            We keep a title, a short excerpt and a link — never the full article. Images appear only where they are public domain or Creative Commons with credit.{" "}
            <Link href="/discover/sources" className="underline">
              Source status
            </Link>
          </p>
        </details>
      </Container>
    </>
  );
}
