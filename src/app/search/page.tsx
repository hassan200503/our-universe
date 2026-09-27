import Link from "next/link";
import { requireCtx } from "@/lib/context";
import { searchAll } from "@/lib/data";
import { Container, PageHeader } from "@/components/ui/page-header";
import { day } from "@/lib/ui/time";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const ctx = await requireCtx();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const hits = query.length >= 2 ? await searchAll(ctx, query) : [];
  const groups = new Map<string, typeof hits>();
  for (const h of hits) {
    const g = h.kind.startsWith("Discovery") ? "Discoveries" : h.kind;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(h);
  }
  return (
    <>
      <PageHeader world="us" eyebrow="Search" title="Find anything in our universe">
        Memories, plans, journals, projects, skills, vault notes, philosophy, and every discovery the feeds have brought in.
      </PageHeader>
      <Container world="us">
        <form action="/search" role="search" className="flex gap-2">
          <input name="q" defaultValue={query} autoFocus placeholder="CRISPR, Spring Boot, hornbill, our trip…" aria-label="Search" className="field max-w-xl text-lg" />
          <button className="btn">Search</button>
        </form>
        {query.length >= 2 && (
          <p className="mt-4 text-sm text-muted">
            {hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”
          </p>
        )}
        <div className="mt-6 space-y-8">
          {[...groups.entries()].map(([g, items]) => (
            <section key={g}>
              <h2 className="font-display text-lg font-semibold">{g}</h2>
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
                {items.map((h, i) => (
                  <li key={`${h.href}-${i}`}>
                    <Link href={h.href} className="block p-4 hover:bg-surface-2">
                      <p className="font-semibold">{h.title}</p>
                      {h.snippet && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{h.snippet}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {[h.kind, h.owner?.split(" ")[0], h.date ? day(h.date) : null].filter(Boolean).join(" · ")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
