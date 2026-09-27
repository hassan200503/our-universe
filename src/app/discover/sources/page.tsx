import { requireCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { trendSources } from "@/lib/db/schema";
import { SOURCES } from "@/lib/trends/sources";
import { TOPICS } from "@/lib/trends/topics";
import { Container, PageHeader } from "@/components/ui/page-header";
import { ago } from "@/lib/ui/time";

export const metadata = { title: "Source status" };

const TIER = ["", "Official organisation", "University", "Research institution", "Scientific publication", "Government", "Technology publication", "Industry publication", "Open-source / project"];

export default async function SourcesPage() {
  await requireCtx();
  const db = await getDb();
  const states = new Map((await db.select().from(trendSources)).map((s) => [s.key, s]));
  return (
    <>
      <PageHeader world="us" eyebrow="Behind the feeds" title="Source status">
        Every source, what kind of organisation it is, and whether it answered last time. Failing sources retry by themselves with growing gaps, and we honour any rate limit
        they ask for.
      </PageHeader>
      <Container world="us">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Feed</th>
                <th className="p-3">Kind</th>
                <th className="p-3">Last success</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => {
                const st = states.get(s.key);
                return (
                  <tr key={s.key} className="border-t border-line">
                    <td className="p-3 font-semibold">{s.name}</td>
                    <td className="p-3">
                      {TOPICS[s.topic].emoji} {TOPICS[s.topic].label}
                    </td>
                    <td className="p-3 text-muted">{TIER[s.tier]}</td>
                    <td className="p-3 text-muted" suppressHydrationWarning>
                      {st?.lastSuccessAt ? ago(st.lastSuccessAt) : "never"}
                    </td>
                    <td className="p-3">
                      {!st || st.consecutiveFailures === 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">● OK</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300" title={st.lastError ?? ""}>
                          ● Retrying ({st.consecutiveFailures}× · {st.lastError})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  );
}
