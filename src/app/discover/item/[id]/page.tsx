import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { people, savedDiscoveries } from "@/lib/db/schema";
import { getTrend } from "@/lib/trends/query";
import { TOPICS } from "@/lib/trends/topics";
import { TrendCardView } from "@/components/feed/trend-card";
import { Container } from "@/components/ui/page-header";
import { day } from "@/lib/ui/time";

export default async function ItemPage({ params }: PageProps<"/discover/item/[id]">) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = await getTrend(id);
  if (!item) notFound();
  const db = await getDb();
  // Notes are shared inside the relationship only.
  const memberIds = new Set(ctx.members.map((m) => m.id));
  const notes = (
    await db
      .select({ note: savedDiscoveries.note, name: people.displayName, personId: people.id })
      .from(savedDiscoveries)
      .innerJoin(people, eq(people.id, savedDiscoveries.personId))
      .where(and(eq(savedDiscoveries.trendId, id), eq(savedDiscoveries.kind, "save")))
  ).filter((n) => n.note && memberIds.has(n.personId));
  const t = TOPICS[item.topic];
  return (
    <Container className="pt-8">
      <Link href={`/discover/${item.topic}`} className="text-sm text-muted hover:text-ink">
        ← {t.emoji} {t.label}
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,26rem)_1fr]">
        <TrendCardView item={item} />
        <div>
          <h2 className="font-display text-xl font-semibold">About this discovery</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Source</dt>
            <dd>{item.sourceName}</dd>
            <dt className="text-muted">Topic</dt>
            <dd>
              {t.label} · {item.category}
            </dd>
            <dt className="text-muted">{item.contentType === "observation" ? "Shared" : "Published"}</dt>
            <dd>{day(item.publishedAt)}</dd>
            {item.sourceUpdatedAt && (
              <>
                <dt className="text-muted">Last updated</dt>
                <dd>{day(item.sourceUpdatedAt)}</dd>
              </>
            )}
            <dt className="text-muted">Retrieved</dt>
            <dd>{day(item.fetchedAt)}</dd>
            {item.imageLicense && (
              <>
                <dt className="text-muted">Image licence</dt>
                <dd>{item.imageLicense}</dd>
              </>
            )}
          </dl>
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn mt-5">
            Read the original at {item.sourceName} →
          </a>
          {notes.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold">Notes</h3>
              <ul className="mt-2 space-y-2">
                {notes.map((n) => (
                  <li key={n.personId} className="card p-3 text-sm">
                    <span className="font-semibold">{n.name.split(" ")[0]}:</span> {n.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
