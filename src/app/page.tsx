import Link from "next/link";
import { requireCtx, type PublicPerson } from "@/lib/context";
import { birthdayInfo, daysUntil, onThisDay, story, together } from "@/lib/data";
import { recentMedia } from "@/lib/media/queries";
import { todaysQuestion } from "@/lib/together/daily";
import { TogetherNow } from "@/components/home/together-now";
import { QuestionCard } from "@/components/home/question-card";
import { Avatar } from "@/components/avatar";
import { personTopics, todaysDiscovery, type TrendCard } from "@/lib/trends/query";
import { TOPICS, type TopicKey } from "@/lib/trends/topics";
import { TrendCardView } from "@/components/feed/trend-card";
import { Universe } from "@/components/universe";
import { day, nowMs } from "@/lib/ui/time";

const WORLD_LINE: Record<string, string> = {
  hassan: "Computer Science · Software · Technology · Nature · Philosophy",
  whitney: "Biotechnology · Birds · Knitting · Nature · Environment",
};
const ICON: Record<string, string> = { memory: "❤️", milestone: "🌹", adventure: "🧭", plan: "🗺️", discovery: "✨" };
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

function WorldCard({ person, topics }: { person: PublicPerson; topics: TopicKey[] }) {
  const first = person.displayName.split(" ")[0];
  return (
    <Link href={`/world/${person.slug}`} data-world={person.theme} className="card-glow lift group relative block overflow-hidden p-7 sm:p-9">
      <div className={`absolute inset-0 opacity-70 bg-${person.theme}`} aria-hidden />
      <div className="relative">
        <p className="eyebrow">{first}&apos;s world</p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{person.focus ?? person.headline ?? first}</h2>
        <p className={`mt-2 text-sm text-muted ${person.theme === "hassan" ? "font-mono" : ""}`}>{WORLD_LINE[person.theme] ?? topics.map((t) => TOPICS[t].label).join(" · ")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {topics.map((t) => (
            <span key={t} className="grid size-11 place-items-center rounded-2xl bg-surface/80 text-xl shadow-sm ring-1 ring-line backdrop-blur" title={TOPICS[t].label}>
              {TOPICS[t].emoji}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm font-semibold text-accent">
          Enter {first}&apos;s world <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </p>
      </div>
    </Link>
  );
}

function Today({ title, item, world }: { title: string; item: TrendCard | null; world: string }) {
  return (
    <div data-world={world} className="flex flex-col">
      <p className="eyebrow mb-3">{title}</p>
      {item ? <TrendCardView item={item} /> : <p className="card flex-1 p-6 text-sm text-muted">Nothing fresh enough yet today — sources are checked through the day.</p>}
    </div>
  );
}

export default async function Home() {
  const ctx = await requireCtx();
  const now = new Date(nowMs());
  const members = ctx.members;
  const topicsBy = new Map(await Promise.all(members.map(async (m) => [m.id, await personTopics(m.id)] as const)));
  const mainTopic = (id: string) => topicsBy.get(id)?.find((t) => t !== "nature");
  const partner = ctx.partners[0];
  const [recent, photos, memoriesToday, mine, theirs, shared, question] = await Promise.all([
    story(ctx, { limit: 4 }),
    recentMedia(ctx, 7).then((m) => m.filter((x) => x.thumbUrl)),
    onThisDay(ctx, now),
    todaysDiscovery({ topics: mainTopic(ctx.me.id) ? [mainTopic(ctx.me.id)!] : [], seed: ctx.me.slug }),
    partner ? todaysDiscovery({ topics: mainTopic(partner.id) ? [mainTopic(partner.id)!] : [], seed: partner.slug }) : Promise.resolve(null),
    todaysDiscovery({ topics: [], seed: "together", bridge: true }),
    todaysQuestion(ctx, now),
  ]);
  const t = together(ctx.relationship.startedOn, now);
  const meetIn = daysUntil(ctx.relationship.nextMeetOn, now);
  const birthdays = members
    .map((m) => ({ m, b: birthdayInfo(m.birthday, now) }))
    .filter((x): x is { m: PublicPerson; b: NonNullable<ReturnType<typeof birthdayInfo>> } => !!x.b && x.b.days <= 45)
    .sort((x, y) => x.b.days - y.b.days);
  const birthdayToday = birthdays.find((x) => x.b.days === 0);
  const [a, b] = members;
  const firstOf = (p?: PublicPerson) => p?.displayName.split(" ")[0] ?? "";

  return (
    <div>
      {/* ── OUR UNIVERSE ─────────────────────────────────────────── */}
      <section data-world="us" className="bg-us grain relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 pb-10 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr]">
          <div className="rise text-center lg:text-left">
            <p className="eyebrow">Our Universe</p>
            <h1 className="display-xl mt-4">
              {firstOf(a)} <span className="text-gradient">&amp;</span> {firstOf(b)}
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted lg:mx-0">
              Welcome back, {firstOf(ctx.me)}. Two worlds — {firstOf(a)}&apos;s and {firstOf(b)}&apos;s — connected by the story you&apos;re writing together.
            </p>
            {t || meetIn !== null || birthdays.length ? (
              <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                {meetIn !== null && (
                  <div className="card-glow px-5 py-3">
                    <p className="font-display text-3xl font-semibold text-accent">{meetIn === 0 ? "Today ✈️" : meetIn}</p>
                    <p className="text-xs text-muted">{meetIn === 0 ? "you're together today!" : "days until you're together"}</p>
                  </div>
                )}
                {t && (
                  <>
                    <div className="card-glow px-5 py-3">
                      <p className="font-display text-3xl font-semibold text-accent">{t.days.toLocaleString()}</p>
                      <p className="text-xs text-muted">days together</p>
                    </div>
                    <div className="card-glow px-5 py-3">
                      <p className="font-display text-3xl font-semibold">{t.daysToAnniversary === 0 ? "Today 🌹" : t.daysToAnniversary}</p>
                      <p className="text-xs text-muted">{t.daysToAnniversary === 0 ? `your ${ordinal(t.nextYears)} anniversary` : `days to your ${ordinal(t.nextYears)} anniversary`}</p>
                    </div>
                  </>
                )}
                {birthdays.map(({ m, b }) => (
                  <div key={m.id} data-world={m.theme} className="card-glow px-5 py-3">
                    <p className="font-display text-3xl font-semibold text-accent">{b.days === 0 ? "Today 🎂" : b.days}</p>
                    <p className="text-xs text-muted">{b.days === 0 ? `${firstOf(m)}'s birthday!` : `days to ${firstOf(m)}'s birthday 🎂`}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Link href="/settings#us" className="mt-7 inline-block text-sm text-accent underline-offset-4 hover:underline">
                Set the day it all began → see your days together
              </Link>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/story#add" className="btn px-6 py-3">
                ❤️ Add a memory
              </Link>
              <Link href="/story" className="btn btn-ghost px-6 py-3">
                Open our story
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <Universe left={firstOf(a)} right={firstOf(b)} />
          </div>
        </div>
      </section>

      {/* ── RIGHT NOW ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl space-y-5 px-4 pt-8">
        {birthdayToday && (
          <div data-world={birthdayToday.m.theme} className="card-glow rise relative overflow-hidden p-6 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-2 text-3xl tracking-[1em] opacity-40 motion-safe:animate-pulse" aria-hidden>
              🎈🎉🎂💖🎁✨
            </div>
            <Avatar name={birthdayToday.m.displayName} url={birthdayToday.m.avatarUrl} theme={birthdayToday.m.theme} size={84} ring className="relative mt-6" />
            <p className="font-display relative mt-3 text-3xl font-semibold">Happy birthday, {firstOf(birthdayToday.m)}! 🎂</p>
            <p className="relative mt-1 text-muted">{birthdayToday.m.id === ctx.me.id ? "Today is all about you ❤️" : "Make today special — send a song, a photo, a memory."}</p>
          </div>
        )}
        <TogetherNow />
        <QuestionCard q={question} />
      </section>

      {/* ── ON THIS DAY ──────────────────────────────────────────── */}
      {memoriesToday.length > 0 && (
        <section data-world="us" className="mx-auto max-w-6xl px-4 pt-10">
          <div className="card-glow p-6">
            <p className="eyebrow">On this day</p>
            <ul className="mt-3 space-y-2">
              {memoriesToday.map((m) => (
                <li key={m.id} className="font-display text-lg">
                  {now.getUTCFullYear() - new Date(m.occurredOn).getUTCFullYear()} year{now.getUTCFullYear() - new Date(m.occurredOn).getUTCFullYear() === 1 ? "" : "s"} ago: {m.title}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── OUR STORY ────────────────────────────────────────────── */}
      <section data-world="us" className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Our story ❤️</p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Our memories, love, adventures and future</h2>
          </div>
          <Link href="/story" className="text-sm font-semibold text-accent hover:underline">
            The whole story →
          </Link>
        </div>
        {recent.length === 0 && photos.length === 0 ? (
          <Link href="/story#add" className="card-glow lift mt-6 block p-10 text-center">
            <span className="petal inline-block text-5xl" aria-hidden>
              🌹
            </span>
            <p className="font-display mt-4 text-2xl font-semibold">Our first page is waiting.</p>
            <p className="mx-auto mt-2 max-w-md text-muted">The day you met, a favourite date, a photo, somewhere you both want to go. Every story starts with one.</p>
          </Link>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            {photos.length > 0 && (
              <Link href="/gallery" className="grid auto-rows-[9rem] grid-cols-3 gap-2 overflow-hidden rounded-[22px]" aria-label="Open our gallery">
                {photos.slice(0, 6).map((p, i) => (
                  <span key={p.id} className={`relative block overflow-hidden ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed private thumbnail */}
                    <img src={p.thumbUrl!} alt={p.caption ?? "From our gallery"} loading="lazy" className="size-full object-cover transition duration-500 hover:scale-105" />
                    {p.kind !== "photo" && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{p.kind === "song" ? "♪" : "▶"}</span>}
                    {p.isNew && <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[0.6rem] font-bold text-accent-ink">NEW</span>}
                  </span>
                ))}
              </Link>
            )}
            <ol className={`space-y-3 ${photos.length === 0 ? "lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0" : ""}`}>
              {recent.map(({ m, by, byTheme }) => (
                <li key={m.id}>
                  <Link href="/story" className="card lift flex items-center gap-4 p-4">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-accent-soft text-2xl" aria-hidden>
                        {ICON[m.kind] ?? "❤️"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg font-semibold">{m.title}</p>
                      <p className="text-xs text-muted">
                        {day(m.occurredOn)} · <span data-world={byTheme} className="text-accent">{by.split(" ")[0]}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* ── TWO WORLDS ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid gap-5 md:grid-cols-2">
          {members.map((m) => (
            <WorldCard key={m.id} person={m} topics={topicsBy.get(m.id) ?? []} />
          ))}
        </div>
      </section>

      {/* ── OUR SHARED WORLD ─────────────────────────────────────── */}
      <section data-world="us" className="border-t border-line bg-surface-2/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="eyebrow">Our shared world</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Today&apos;s discoveries</h2>
          <p className="mt-2 max-w-2xl text-muted">Chosen each morning from what real sources published in the last few days. The same all day; something new tomorrow.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Today title={`${firstOf(ctx.me)} · ${mainTopic(ctx.me.id) ? TOPICS[mainTopic(ctx.me.id)!].label : "Discovery"}`} item={mine} world={ctx.me.theme} />
            {partner && <Today title={`${firstOf(partner)} · ${mainTopic(partner.id) ? TOPICS[mainTopic(partner.id)!].label : "Discovery"}`} item={theirs} world={partner.theme} />}
            <Today title="For both of you" item={shared} world="us" />
          </div>
          <nav aria-label="Shared areas" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/discover/nature", emoji: "🌿", title: "Nature, together", text: "Wildlife, forests and fresh sightings in Kenya" },
              { href: "/discover/together", emoji: "🔗", title: "Something we both might like", text: "Where technology meets life" },
              { href: "/learning", emoji: "📚", title: "Things we are learning", text: "Facts, books, documentaries, ideas" },
              { href: "/digest", emoji: "🗞️", title: "This week in our world", text: "What happened, what we found" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="card lift p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-xl" aria-hidden>
                  {l.emoji}
                </span>
                <p className="mt-3 font-semibold">{l.title}</p>
                <p className="text-sm text-muted">{l.text}</p>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <footer className="py-12 text-center">
        <p className="font-display text-lg italic text-muted">“Two worlds, one story.”</p>
      </footer>
    </div>
  );
}
