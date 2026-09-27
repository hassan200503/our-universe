import Link from "next/link";
import { requireCtx } from "@/lib/context";
import { TOPIC_KEYS } from "@/lib/trends/topics";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Saved" };

const TABS = [
  { kind: null, label: "Everything" },
  { kind: "save", label: "❤️ Saved" },
  { kind: "favorite", label: "⭐ Favourites" },
  { kind: "bookmark", label: "📌 Bookmarks" },
];

export default async function SavedPage({ searchParams }: PageProps<"/discover/saved">) {
  const ctx = await requireCtx();
  const { kind } = await searchParams;
  const k = typeof kind === "string" && TABS.some((t) => t.kind === kind) ? kind : null;
  return (
    <>
      <PageHeader world={ctx.me.theme} eyebrow="Kept by you" title="Saved discoveries">
        Everything you&apos;ve saved stays here, even when a source goes quiet.
      </PageHeader>
      <Container world={ctx.me.theme}>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link key={t.label} href={t.kind ? `/discover/saved?kind=${t.kind}` : "/discover/saved"} className={`chip ${k === t.kind ? "ring-1 ring-accent" : "bg-transparent text-muted"}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="mt-5">
          <InfiniteFeed
            key={k ?? "all"}
            params={{ feed: "saved", kind: k }}
            topics={[...TOPIC_KEYS]}
            empty={<p className="card mt-4 p-6 text-center text-muted">Nothing saved yet. Tap ❤️ ⭐ or 📌 on any discovery.</p>}
          />
        </div>
      </Container>
    </>
  );
}
