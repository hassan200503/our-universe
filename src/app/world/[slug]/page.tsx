import Link from "next/link";
import { worldPerson } from "@/lib/world-page";
import { journal, personStats, projectList, radar } from "@/lib/data";
import { latestInTopic, personTopics, todaysDiscovery } from "@/lib/trends/query";
import { TOPICS } from "@/lib/trends/topics";
import { kindLabel, worldFor } from "@/lib/worlds";
import { TrendCardView } from "@/components/feed/trend-card";
import { day } from "@/lib/ui/time";

export async function generateMetadata({ params }: PageProps<"/world/[slug]">) {
  const { slug } = await params;
  return { title: `${slug[0].toUpperCase()}${slug.slice(1)}'s World` };
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-3xl font-semibold text-accent">{n}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function WorldDashboard({ params }: PageProps<"/world/[slug]">) {
  const { ctx, person, own, first } = await worldPerson(params);
  const topics = await personTopics(person.id);
  const cfg = worldFor(person.theme);
  const [stats, entries, projects, lanes, today, latest] = await Promise.all([
    personStats(ctx, person.id),
    journal(ctx, person.id, { limit: 20 }),
    person.features.includes("projects") ? projectList(ctx, person.id) : Promise.resolve([]),
    radar(person.id),
    todaysDiscovery({ topics: topics.slice(0, 1), seed: `${person.slug}-world` }),
    Promise.all(topics.map(async (t) => [t, await latestInTopic(t)] as const)),
  ]);
  const goal = entries.find((e) => e.kind === "goal" && e.status !== "done");
  const recent = entries[0];
  const current = projects.find((p) => p.current) ?? projects[0];
  const done = entries.filter((e) => e.status === "done").length;
  const main = topics[0];

  return (
    <div className="space-y-12">
      {/* Introduction & interests */}
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">{own ? "About you" : `About ${first}`}</h2>
          {person.intro ? (
            <div className="mt-3 space-y-3 leading-relaxed">
              {person.intro.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-muted">{own ? "Write a few lines about yourself in Settings." : `${first} hasn't written an introduction yet.`}</p>
          )}
          {own && (
            <Link href="/settings" className="mt-3 inline-block text-sm text-accent hover:underline">
              Edit profile
            </Link>
          )}
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">Interests</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {topics.map((t) => (
              <li key={t}>
                <Link href={`/discover/${t}`} className="card flex items-center gap-3 p-3 transition hover:border-accent">
                  <span className="text-2xl" aria-hidden>
                    {TOPICS[t].emoji}
                  </span>
                  <span className="text-sm font-semibold">{TOPICS[t].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Now */}
      <section className="grid gap-5 md:grid-cols-3">
        <div className="card p-5">
          <p className="eyebrow">Current learning goal</p>
          {goal ? (
            <>
              <p className="font-display mt-2 text-lg font-semibold">{goal.title}</p>
              {goal.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{goal.description}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No goal set yet. Add one to the {person.journalTitle} as “🎯 Goal”.</p>
          )}
        </div>
        {person.features.includes("projects") && (
          <div className="card p-5">
            <p className="eyebrow">Current project</p>
            {current ? (
              <>
                <p className="font-display mt-2 text-lg font-semibold">{current.name}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted">{current.description}</p>
                <Link href={`/world/${person.slug}/projects`} className="mt-2 inline-block text-sm text-accent hover:underline">
                  See what&apos;s being built →
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing marked as current.</p>
            )}
          </div>
        )}
        <div className="card p-5">
          <p className="eyebrow">Most recent journal entry</p>
          {recent ? (
            <>
              <p className="mt-2 text-xs text-muted">
                {kindLabel(cfg.journalKinds, recent.kind)} · {day(recent.occurredOn)}
              </p>
              <p className="font-display mt-1 text-lg font-semibold">{recent.title}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">The {person.journalTitle} is empty — the first entry is the hardest.</p>
          )}
          <Link href={`/world/${person.slug}/journal`} className="mt-2 inline-block text-sm text-accent hover:underline">
            Open the {person.journalTitle} →
          </Link>
        </div>
        {!person.features.includes("projects") && (
          <div className="card p-5">
            <p className="eyebrow">{person.journalTitle} progress</p>
            <p className="font-display mt-2 text-3xl font-semibold">
              {done}
              <span className="text-lg text-muted"> / {entries.length} done</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${entries.length ? Math.round((done / entries.length) * 100) : 0}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat n={stats.journal} label={`${person.journalTitle} entries`} />
        <Stat n={stats.journal30} label="entries in the last 30 days" />
        {person.features.includes("projects") && <Stat n={stats.projects} label="projects" />}
        <Stat n={stats.knowledge} label="notes & saved resources" />
        <Stat n={stats.saved} label="discoveries saved" />
      </section>

      {/* Today's discovery + latest per interest */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">What&apos;s new in {own ? "your" : `${first}'s`} world</h2>
          <Link href={own ? "/discover" : `/discover?as=${person.slug}`} className="text-sm font-semibold text-accent hover:underline">
            Open For You →
          </Link>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="eyebrow mb-2">Today&apos;s {main ? TOPICS[main].label : ""} discovery</p>
            {today ? <TrendCardView item={today} /> : <p className="card p-5 text-sm text-muted">Nothing fresh enough yet today.</p>}
          </div>
          {latest
            .filter(([t, item]) => item && t !== main)
            .map(([t, item]) => (
              <div key={t}>
                <p className="eyebrow mb-2">Latest in {TOPICS[t].label}</p>
                <TrendCardView item={item!} compact />
              </div>
            ))}
        </div>
      </section>

      {/* Radar summary */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">{person.radarTitle}</h2>
          <Link href={`/world/${person.slug}/radar`} className="text-sm font-semibold text-accent hover:underline">
            Open →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {lanes.map((l) => (
            <div key={l.id} className="card p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{l.name}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {l.items.slice(0, 4).map((i) => (
                  <li key={i.id}>{i.name}</li>
                ))}
                {l.items.length === 0 && <li className="text-muted">—</li>}
                {l.items.length > 4 && <li className="text-xs text-muted">+{l.items.length - 4} more</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="font-display py-6 text-center text-xl italic text-muted">{person.motto ?? cfg.tagline}</p>
    </div>
  );
}
