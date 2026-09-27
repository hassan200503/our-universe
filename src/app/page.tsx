import Link from "next/link";
import { requireCtx, type PublicPerson } from "@/lib/context";
import { story } from "@/lib/data";
import { personTopics, todaysDiscovery, type TrendCard } from "@/lib/trends/query";
import { TOPICS } from "@/lib/trends/topics";
import { TrendCardView } from "@/components/feed/trend-card";
import { day } from "@/lib/ui/time";

const WORLD_EMOJI: Record<string, string> = { hassan: "💻🧠🌿", whitney: "🧬🐦🧶🌿" };

function WorldCard({ person, topics }: { person: PublicPerson; topics: string[] }) {
  const first = person.displayName.split(" ")[0];
  return (
    <Link href={`/world/${person.slug}`} data-world={person.theme} className={`card group relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-lg bg-${person.theme}`}>
      <p className="eyebrow">{first.toUpperCase()}&apos;S WORLD</p>
      <p className="mt-2 text-2xl" aria-hidden>
        {WORLD_EMOJI[person.theme] ?? "✨"}
      </p>
      <h2 className="font-display mt-2 text-2xl font-semibold">{person.focus ?? person.headline ?? first}</h2>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <li key={t} className="chip">
            {TOPICS[t as keyof typeof TOPICS]?.label ?? t}
          </li>
        ))}
      </ul>
      <span className="mt-5 inline-block text-sm font-semibold text-accent group-hover:underline">Enter {first}&apos;s world →</span>
    </Link>
  );
}

function Today({ title, item, world }: { title: string; item: TrendCard | null; world: string }) {
  return (
    <div data-world={world}>
      <p className="eyebrow mb-2">{title}</p>
      {item ? <TrendCardView item={item} /> : <p className="card p-6 text-sm text-muted">Nothing fresh enough today yet — sources are checked through the day.</p>}
    </div>
  );
}

export default async function Home() {
  const ctx = await requireCtx();
  const members = ctx.members;
  const topicsBy = new Map(await Promise.all(members.map(async (m) => [m.id, await personTopics(m.id)] as const)));
  const [recent, mine, together] = await Promise.all([
    story(ctx, { limit: 3 }),
    todaysDiscovery({ topics: topicsBy.get(ctx.me.id)?.filter((t) => t !== "nature").slice(0, 1) ?? [], seed: ctx.me.slug }),
    todaysDiscovery({ topics: [], seed: "together", bridge: true }),
  ]);
  const partner = ctx.partners[0];
  const partnerPick = partner ? await todaysDiscovery({ topics: topicsBy.get(partner.id)?.filter((t) => t !== "nature").slice(0, 1) ?? [], seed: partner.slug }) : null;
  const myFirst = ctx.me.displayName.split(" ")[0];
  const myMainTopic = topicsBy.get(ctx.me.id)?.[0];
  const partnerMainTopic = partner ? topicsBy.get(partner.id)?.[0] : undefined;
  const hello = myFirst;

  return (
    <div>
      {/* OUR STORY */}
      <section data-world="us" className="bg-us">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 text-center sm:pt-20">
          <p className="eyebrow">Our Universe</p>
          <h1 className="font-display mx-auto mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            {members.map((m, i) => (
              <span key={m.id}>
                {i > 0 && (
                  <span className="petal mx-3 inline-block text-accent" aria-label="and">
                    ❤
                  </span>
                )}
                {m.displayName.split(" ")[0]}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">Welcome back, {hello}. Two worlds, connected by our story.</p>
          <div className="mx-auto mt-10 max-w-3xl text-left">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-semibold">Our Story ❤️</h2>
              <Link href="/story" className="text-sm font-semibold text-accent hover:underline">
                Open our story →
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted">Our memories, love, adventures and future.</p>
            {recent.length ? (
              <ol className="mt-4 space-y-3">
                {recent.map(({ m, by }) => (
                  <li key={m.id} className="card flex gap-4 p-4">
                    <span className="text-2xl" aria-hidden>
                      {m.kind === "plan" ? "🗺️" : m.kind === "discovery" ? "✨" : m.kind === "milestone" ? "🌹" : "❤️"}
                    </span>
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-xs text-muted">
                        {day(m.occurredOn)} · added by {by.split(" ")[0]}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Link href="/story" className="card mt-4 block p-6 text-center hover:border-accent">
                <span className="text-3xl" aria-hidden>
                  🌹
                </span>
                <p className="font-display mt-2 text-lg font-semibold">Our first page is waiting.</p>
                <p className="text-sm text-muted">Add a memory, a date, a plan — the story starts with one.</p>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* TWO WORLDS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-5 md:grid-cols-2">
          {members.map((m) => (
            <WorldCard key={m.id} person={m} topics={topicsBy.get(m.id) ?? []} />
          ))}
        </div>
      </section>

      {/* SHARED WORLD */}
      <section data-world="us" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="eyebrow">Our shared world ❤️</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Today&apos;s discoveries</h2>
          <p className="mt-2 max-w-2xl text-muted">Picked each morning from what real sources published in the last few days. The same all day; something new tomorrow.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Today title={`Today's ${myMainTopic ? TOPICS[myMainTopic].label : ""} discovery · ${myFirst}`} item={mine} world={ctx.me.theme} />
            {partner && <Today title={`Today's ${partnerMainTopic ? TOPICS[partnerMainTopic].label : ""} discovery · ${partner.displayName.split(" ")[0]}`} item={partnerPick} world={partner.theme} />}
            <Today title="Today's shared discovery" item={together} world="us" />
          </div>
          <nav aria-label="Shared areas" className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/discover/nature", emoji: "🌿", title: "Nature, together", text: "Wildlife, forests and fresh sightings in Kenya" },
              { href: "/discover/together", emoji: "🔗", title: "Something we both might like", text: "Where technology meets life" },
              { href: "/learning", emoji: "📚", title: "Things we are learning", text: "Facts, books, documentaries, ideas" },
              { href: "/digest", emoji: "🗞️", title: "This week in our world", text: "What happened, what we found" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="card p-5 transition hover:border-accent">
                <span className="text-2xl" aria-hidden>
                  {l.emoji}
                </span>
                <p className="mt-2 font-semibold">{l.title}</p>
                <p className="text-sm text-muted">{l.text}</p>
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </div>
  );
}
