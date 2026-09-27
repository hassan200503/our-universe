import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { people, projects } from "@/lib/db/schema";
import { skillList } from "@/lib/data";
import { Meter } from "@/components/ui/meter";

/**
 * Public profile. Off unless the person turns it on, and it only ever reads
 * rows marked "public". No nickname, memories, journals or vaults.
 */
export async function generateMetadata({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  return { title: slug[0]?.toUpperCase() + slug.slice(1), robots: { index: false } };
}

export default async function PublicProfile({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const db = await getDb();
  const [p] = await db
    .select({ id: people.id, displayName: people.displayName, headline: people.headline, course: people.course, intro: people.intro, theme: people.theme, publicProfile: people.publicProfile })
    .from(people)
    .where(eq(people.slug, slug));
  if (!p || !p.publicProfile) notFound();
  const [sk, pr] = await Promise.all([
    skillList(p.id, ["public"]),
    db.select().from(projects).where(and(eq(projects.personId, p.id), eq(projects.visibility, "public"))).orderBy(desc(projects.updatedAt)),
  ]);
  return (
    <div data-world={p.theme} className={`bg-${p.theme} min-h-dvh`}>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-5xl font-semibold tracking-tight">{p.displayName}</h1>
        <p className="mt-3 text-lg">{[p.course, p.headline].filter(Boolean).join(" · ")}</p>
        {p.intro && (
          <div className="mt-6 space-y-3 leading-relaxed">
            {p.intro.split(/\n{2,}/).map((x, i) => (
              <p key={i}>{x}</p>
            ))}
          </div>
        )}
        {pr.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold">Projects</h2>
            <ul className="mt-4 space-y-4">
              {pr.map((x) => (
                <li key={x.id} className="card p-5">
                  <p className="font-display text-xl font-semibold">{x.name}</p>
                  <p className="mt-1 text-muted">{x.description}</p>
                  <p className="mt-2 font-mono text-xs">{x.stack.join(" · ")}</p>
                  <p className="mt-3 flex gap-4 text-sm">
                    {x.repoUrl && <a href={x.repoUrl} className="text-accent underline">Repository</a>}
                    {x.liveUrl && <a href={x.liveUrl} className="text-accent underline">Live</a>}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {sk.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold">Skills</h2>
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
              {sk.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <span className="font-semibold">{s.name}</span>
                  <Meter level={s.level} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
