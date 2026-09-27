import Link from "next/link";
import { requireCtx } from "@/lib/context";
import { digest } from "@/lib/data";
import { personTopics } from "@/lib/trends/query";
import { TOPICS, type TopicKey } from "@/lib/trends/topics";
import { Container, PageHeader } from "@/components/ui/page-header";
import { day, nowMs } from "@/lib/ui/time";

export const metadata = { title: "This Week" };

/**
 * The weekly digest, rendered as a page. The same `digest()` read model is what
 * a future email or push notification would send; nothing here is page-specific.
 */
export default async function DigestPage({ searchParams }: PageProps<"/digest">) {
  const ctx = await requireCtx();
  const { weeks } = await searchParams;
  const back = Math.max(0, Math.min(52, Number(weeks) || 0));
  const to = new Date(nowMs() - back * 7 * 86400_000);
  const from = new Date(to.getTime() - 7 * 86400_000);
  const d = await digest(ctx, from, to);
  const topicsBy = new Map(await Promise.all(ctx.members.map(async (m) => [m.id, await personTopics(m.id)] as const)));
  const highlight = new Map(d.highlights.map((h) => [h.topic, h]));

  return (
    <>
      <PageHeader world="us" eyebrow="Weekly digest 🗞️" title={back === 0 ? "This week in our world" : `The week of ${day(from)}`}>
        {day(from)} – {day(to)}.{" "}
        <Link href={`/digest?weeks=${back + 1}`} className="underline">
          Previous week
        </Link>
        {back > 0 && (
          <>
            {" · "}
            <Link href={back === 1 ? "/digest" : `/digest?weeks=${back - 1}`} className="underline">
              Next week
            </Link>
          </>
        )}
      </PageHeader>
      <Container world="us">
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            [d.memories.filter((m) => m.kind !== "plan" && m.kind !== "discovery").length, "memories added"],
            [d.memories.filter((m) => m.photoUrl).length, "photos"],
            [d.memories.filter((m) => m.kind === "plan").length, "plans made"],
            [d.memories.filter((m) => m.kind === "discovery").length + d.learning.length, "shared discoveries & lessons"],
          ].map(([n, label]) => (
            <div key={label as string} className="card p-4">
              <p className="font-display text-3xl font-semibold text-accent">{n}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </section>

        {ctx.members.map((m) => {
          const first = m.displayName.split(" ")[0];
          const topics = (topicsBy.get(m.id) ?? []) as TopicKey[];
          const saved = d.saves.filter((s) => s.personId === m.id);
          const records = d.records.filter((r) => r.personId === m.id);
          return (
            <section key={m.id} data-world={m.theme} className="mt-12">
              <h2 className="font-display text-2xl font-semibold">This week in {first}&apos;s world</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {topics.map((t) => {
                  const h = highlight.get(t);
                  return (
                    <div key={t} className="card p-4">
                      <p className="eyebrow">
                        {TOPICS[t].emoji} {TOPICS[t].label}
                      </p>
                      {h ? (
                        <a href={h.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold hover:underline">
                          {h.title}
                          <span className="block text-xs font-normal text-muted">
                            {h.source_name} · {day(h.published_at)}
                          </span>
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-muted">Nothing published this week.</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {(records.length > 0 || saved.length > 0) && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {records.length > 0 && (
                    <div>
                      <h3 className="font-semibold">{m.journalTitle}</h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {records.map((r) => (
                          <li key={r.id}>· {r.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {saved.length > 0 && (
                    <div>
                      <h3 className="font-semibold">Saved</h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {[...new Map(saved.map((s) => [s.t.id, s.t])).values()].slice(0, 8).map((t) => (
                          <li key={t.id}>
                            ·{" "}
                            <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {t.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">This week in our world</h2>
          {d.memories.length + d.learning.length === 0 ? (
            <p className="card mt-4 p-6 text-muted">A quiet week for our story. There&apos;s still time to add one.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {d.memories.map((m) => (
                <li key={m.id} className="card p-3 text-sm">
                  {m.kind === "plan" ? (m.planDone ? "✅" : "🗺️") : m.kind === "discovery" ? "✨" : "❤️"} {m.title}
                </li>
              ))}
              {d.learning.map((l) => (
                <li key={l.id} className="card p-3 text-sm">
                  📚 {l.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </>
  );
}
