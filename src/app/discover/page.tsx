import Link from "next/link";
import { requireCtx } from "@/lib/context";
import { personTopics } from "@/lib/trends/query";
import { TOPICS } from "@/lib/trends/topics";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "For You" };

export default async function ForYouPage({ searchParams }: PageProps<"/discover">) {
  const ctx = await requireCtx();
  const { as } = await searchParams;
  const viewing = ctx.members.find((m) => m.slug === as) ?? ctx.me;
  const topics = await personTopics(viewing.id);
  const self = viewing.id === ctx.me.id;
  const others = ctx.members.filter((m) => m.id !== viewing.id);
  return (
    <>
      <PageHeader world={viewing.theme} eyebrow="For You" title={self ? `Something new, ${viewing.displayName.split(" ")[0]}` : `What ${viewing.displayName.split(" ")[0]} is discovering`}>
        A mix of everything {self ? "you follow" : `${viewing.displayName.split(" ")[0]} follows`}, freshest first, with no single topic crowding out the rest.
      </PageHeader>
      <Container world={viewing.theme}>
        <div className="flex flex-wrap items-center gap-2">
          {topics.map((t) => (
            <Link key={t} href={`/discover/${t}`} className="chip hover:brightness-95">
              <span aria-hidden>{TOPICS[t].emoji}</span> {TOPICS[t].label}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          {others.map((o) => (
            <Link key={o.id} href={o.id === ctx.me.id ? "/discover" : `/discover?as=${o.slug}`} className="text-sm text-muted underline-offset-4 hover:underline">
              {o.id === ctx.me.id ? "Back to mine" : `Peek at ${o.displayName.split(" ")[0]}'s`}
            </Link>
          ))}
          <Link href="/discover/saved" className="text-sm text-muted underline-offset-4 hover:underline">
            Saved
          </Link>
          <Link href="/settings#personalise" className="text-sm text-muted underline-offset-4 hover:underline">
            Personalise
          </Link>
        </div>
        <div className="mt-6">
          <InfiniteFeed key={viewing.slug} params={{ feed: "for-you", as: viewing.slug }} topics={topics} />
        </div>
      </Container>
    </>
  );
}
