import { requireCtx } from "@/lib/context";
import { TOPIC_KEYS } from "@/lib/trends/topics";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Something We Both Might Like" };

export default async function TogetherPage() {
  const ctx = await requireCtx();
  const names = ctx.members.map((m) => m.displayName.split(" ")[0]).join(" and ");
  return (
    <>
      <PageHeader world="us" eyebrow="Shared discovery" title="Something we both might like">
        Where {names}&apos;s worlds overlap: AI meeting biology, technology helping wildlife, ideas about minds and nature. Every item here touches both a technology thread and a
        life-science thread.
      </PageHeader>
      <Container world="us">
        <InfiniteFeed params={{ feed: "together" }} topics={[...TOPIC_KEYS]} />
      </Container>
    </>
  );
}
