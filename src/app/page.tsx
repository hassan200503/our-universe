import Link from "next/link";
import { cookies } from "next/headers";
import { requireCtx, type PublicPerson } from "@/lib/context";
import { birthdayInfo, daysUntil, onThisDay, story, together } from "@/lib/data";
import { galleryPage, recentMedia } from "@/lib/media/queries";
import { todaysQuestion } from "@/lib/together/daily";
import { unreadSummary } from "@/lib/chat/server";
import { withSchema } from "@/lib/db/client";
import { pick, pickOne, parseVerse, roman, VERSE_COOKIE, VERSES, VOW_COOKIE, VOWS } from "@/lib/journey/verses";
import { TogetherNow } from "@/components/home/together-now";
import { QuestionCard } from "@/components/home/question-card";
import { JourneyClock } from "@/components/home/journey-clock";
import { RememberLines } from "@/components/home/remember";
import { Orbit, Starfield } from "@/components/home/sky";
import { Avatar } from "@/components/avatar";
import { IconArrowRight, IconCompass, IconFlask, IconHeart, IconImage, IconMessage, IconSparkle, Monogram } from "@/components/icons";
import { personTopics, todaysDiscovery, type TrendCard } from "@/lib/trends/query";
import { TOPICS, type TopicKey } from "@/lib/trends/topics";
import { TrendCardView } from "@/components/feed/trend-card";
import { day, nowMs } from "@/lib/ui/time";

const WORLD_LINE: Record<string, string[]> = {
  hassan: ["Computer Science", "Software", "Technology", "Nature", "Philosophy"],
  whitney: ["Biotechnology", "Birds", "Knitting", "Nature", "Environment"],
};
const KIND: Record<string, string> = { memory: "A memory", milestone: "A milestone", adventure: "An adventure", plan: "A plan", discovery: "A discovery" };
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const firstOf = (p?: { displayName: string }) => p?.displayName.split(" ")[0] ?? "";
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fullDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The verse, word by word: each word drifts into focus a moment after the last. */
function Verse({ text }: { text: string }) {
  let i = 0;
  return (
    <h1 className="verse font-lux text-balance text-[2.55rem] font-normal leading-[1.04] tracking-[-0.012em] text-[#f7efe1] sm:text-[3.6rem] lg:text-[4.35rem]">
      {parseVerse(text).map((part, p) =>
        part.t.split(/(\s+)/).map((w, k) =>
          /^\s+$/.test(w) ? (
            <span key={`${p}-${k}`}> </span>
          ) : w ? (
            <span key={`${p}-${k}`} className={`w ${part.em ? "gold-shimmer italic" : ""}`} style={{ "--i": i++ } as React.CSSProperties}>
              {w}
            </span>
          ) : null,
        ),
      )}
    </h1>
  );
}

function Milestone({ label, value, unit, detail, progress, world, href }: { label: string; value: string; unit?: string; detail: string; progress?: number; world?: string; href?: string }) {
  const body = (
    <>
      <p className="eyebrow-lux">{label}</p>
      <p className="mt-5 flex items-baseline gap-2">
        <span data-world={world} className={`num-lux text-[4.2rem] ${world ? "text-accent" : ""}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </p>
      <p className="mt-2 text-sm text-muted">{detail}</p>
      {progress !== undefined && (
        <div className="mt-6 h-px w-full overflow-hidden bg-line" aria-hidden>
          <div className="h-full bg-gradient-to-r from-gold/40 to-gold" style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%` }} />
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="tile lift block p-6 sm:p-7">
      {body}
    </Link>
  ) : (
    <div className="tile p-6 sm:p-7">{body}</div>
  );
}

function WorldCard({ person, topics }: { person: PublicPerson; topics: TopicKey[] }) {
  const first = firstOf(person);
  const line = WORLD_LINE[person.theme] ?? topics.map((t) => TOPICS[t].label);
  return (
    <Link href={`/world/${person.slug}`} data-world={person.theme} className="tile lift group relative block overflow-hidden p-7 sm:p-10">
      <div className={`absolute inset-0 opacity-60 bg-${person.theme}`} aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-3">
          <Avatar name={person.displayName} url={person.avatarUrl} theme={person.theme} size={40} />
          <p className="eyebrow-lux">{first}&apos;s world</p>
        </div>
        <h3 className="font-lux mt-7 text-[2.3rem] font-medium leading-[1.05] tracking-tight sm:text-[2.8rem]">{person.focus ?? person.headline ?? first}</h3>
        <p className={`mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted ${person.theme === "hassan" ? "font-mono text-[0.8rem]" : ""}`}>
          {line.map((t, i) => (
            <span key={t} className="flex items-center gap-3">
              {i > 0 && <span className="size-1 rounded-full bg-accent/50" aria-hidden />}
              {t}
            </span>
          ))}
        </p>
        <p className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-accent">
          Step into {first}&apos;s world <IconArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  );
}

function Today({ title, item, world }: { title: string; item: TrendCard | null; world: string }) {
  return (
    <div data-world={world} className="flex flex-col">
      <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent">{title}</p>
      {item ? <TrendCardView item={item} /> : <p className="tile flex-1 p-6 text-sm text-muted">Nothing fresh enough yet today — sources are checked through the day.</p>}
    </div>
  );
}

function SectionHead({ eyebrow, title, action }: { eyebrow: string; title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow-lux">{eyebrow}</p>
        <h2 className="font-lux mt-3 text-[2.2rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default async function Home() {
  const ctx = await requireCtx();
  const jar = await cookies();
  const verse = pick(VERSES, jar.get(VERSE_COOKIE)?.value);
  const vow = pick(VOWS, jar.get(VOW_COOKIE)?.value);
  const serverNow = nowMs();
  const now = new Date(serverNow);
  const members = ctx.members;
  const partner = ctx.partners[0];
  const topicsBy = new Map(await Promise.all(members.map(async (m) => [m.id, await personTopics(m.id)] as const)));
  const mainTopic = (id: string) => topicsBy.get(id)?.find((t) => t !== "nature");
  const [memories, media, photos, memoriesToday, mine, theirs, shared, question, unread] = await Promise.all([
    story(ctx),
    recentMedia(ctx, 7).then((m) => m.filter((x) => x.thumbUrl)),
    galleryPage(ctx, { kind: "photo", limit: 18 }).then((p) => p.items.filter((x) => x.url || x.thumbUrl)),
    onThisDay(ctx, now),
    todaysDiscovery({ topics: mainTopic(ctx.me.id) ? [mainTopic(ctx.me.id)!] : [], seed: ctx.me.slug }),
    partner ? todaysDiscovery({ topics: mainTopic(partner.id) ? [mainTopic(partner.id)!] : [], seed: partner.slug }) : Promise.resolve(null),
    todaysDiscovery({ topics: [], seed: "together", bridge: true }),
    todaysQuestion(ctx, now),
    withSchema(() => unreadSummary(ctx)).catch(() => ({ unread: 0, latest: null })),
  ]);

  const t = together(ctx.relationship.startedOn, now);
  const meetIn = daysUntil(ctx.relationship.nextMeetOn, now);
  const birthdays = members
    .map((m) => ({ m, b: birthdayInfo(m.birthday, now) }))
    .filter((x): x is { m: PublicPerson; b: NonNullable<ReturnType<typeof birthdayInfo>> } => !!x.b)
    .sort((x, y) => x.b.days - y.b.days);
  const birthdayToday = birthdays.find((x) => x.b.days === 0);
  const [a, b] = members;
  const names = `${firstOf(a)} & ${firstOf(b)}`;

  // A moment from the journey, different on every visit (today's anniversary of a memory comes first).
  const lived = memories.filter((r) => r.m.kind !== "plan");
  const todayMemory = memoriesToday[0] ? lived.find((r) => r.m.id === memoriesToday[0].id) : undefined;
  const moment = todayMemory
    ? ({ type: "memory", row: todayMemory, onThisDay: true } as const)
    : pickOne<{ type: "memory"; row: (typeof lived)[number]; onThisDay: false } | { type: "photo"; item: (typeof photos)[number] }>([
        ...lived.map((row) => ({ type: "memory" as const, row, onThisDay: false as const })),
        ...photos.map((item) => ({ type: "photo" as const, item })),
      ]);
  const momentPhoto = moment?.type === "photo" ? (moment.item.url ?? moment.item.thumbUrl) : moment?.row.m.photoUrl;
  const yearsAgo = todayMemory ? now.getUTCFullYear() - new Date(todayMemory.m.occurredOn).getUTCFullYear() : 0;
  const recent = memories.slice(0, 4);

  const chapter = t ? t.years + 1 : 1;
  const sinceLast = t ? 365 - t.daysToAnniversary : 0;

  return (
    <div className="pb-6">
      <RememberLines cookies={{ [VERSE_COOKIE]: verse.remember, [VOW_COOKIE]: vow.remember }} />

      {/* ── THE STAGE ─────────────────────────────────────────────── */}
      <section className="px-2.5 pt-2.5 sm:px-4 sm:pt-4">
        <div className="stage mx-auto max-w-[1400px] rounded-[28px] sm:rounded-[36px]">
          <div className="aurora" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <Starfield />
          <div className="relative z-[3] mx-auto max-w-6xl px-5 sm:px-10">
            <div className="flex items-center justify-between gap-4 pt-7 sm:pt-9">
              <p className="eyebrow-lux fade-late whitespace-nowrap" style={{ "--d": "0ms" } as React.CSSProperties}>
                <span className="max-sm:hidden">Our Universe{t ? " · " : ""}</span>
                {t ? `Chapter ${roman(chapter)}` : <span className="sm:hidden">Our Universe</span>}
              </p>
              {t && (
                <p className="fade-late whitespace-nowrap text-[0.64rem] uppercase tracking-[0.22em] text-white/55 sm:text-[0.7rem] sm:tracking-[0.28em]" style={{ "--d": "100ms" } as React.CSSProperties}>
                  Day {(t.days + 1).toLocaleString("en")} of forever
                </p>
              )}
            </div>

            <div className="grid items-center gap-6 pb-10 pt-12 sm:pt-16 lg:grid-cols-[1.35fr_1fr] lg:gap-10 lg:pb-16 lg:pt-14">
              <div className="relative z-10">
                <Verse text={verse.text} />
                <div className="fade-late mt-9 flex items-center gap-4" style={{ "--d": "1100ms" } as React.CSSProperties}>
                  <span className="rule-gold w-14" aria-hidden />
                  <p className="text-[0.72rem] uppercase tracking-[0.3em] text-white/60">
                    {names}
                    {ctx.relationship.startedOn && <span className="hidden sm:inline"> · since {fullDate(ctx.relationship.startedOn)}</span>}
                  </p>
                </div>
                <div className="fade-late mt-10 flex flex-wrap items-center gap-3" style={{ "--d": "1300ms" } as React.CSSProperties}>
                  <Link href="/story#add" className="btn-gold">
                    <IconHeart size={17} /> Write today&apos;s page
                  </Link>
                  {partner && (
                    <Link href="/together/chat" className="btn-glass">
                      <IconMessage size={17} /> Message {firstOf(partner)}
                      {unread.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 text-[0.65rem] font-bold leading-5 text-white">{unread.unread}</span>}
                    </Link>
                  )}
                  <Link href="/story" className="group ml-1 inline-flex items-center gap-1.5 px-2 py-2 text-sm text-white/70 transition hover:text-white">
                    Our story <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
              <div className="pointer-events-none absolute -right-20 top-4 w-[300px] opacity-35 sm:-right-12 sm:w-[420px] lg:relative lg:right-auto lg:top-auto lg:w-auto lg:opacity-100">
                <div className="fade-late" style={{ "--d": "400ms" } as React.CSSProperties}>
                  <Orbit left={firstOf(a)} right={firstOf(b)} className="mx-auto h-auto w-full max-w-[520px]" />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 py-8 sm:py-10">
              {ctx.relationship.startedOn && t ? (
                <div className="fade-late" style={{ "--d": "1500ms" } as React.CSSProperties}>
                  <p className="mb-6 text-center text-[0.66rem] uppercase tracking-[0.34em] text-white/45">Walking this road together for</p>
                  <JourneyClock startedOn={ctx.relationship.startedOn} serverNow={serverNow} />
                </div>
              ) : (
                <Link href="/settings#us" className="group flex items-center justify-center gap-2 text-sm text-white/70 hover:text-white">
                  Tell Our Universe the day your journey began, and it will count every moment since <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── THE ROAD AHEAD ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <SectionHead eyebrow="The road ahead" title="What we're walking toward" />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetIn !== null ? (
            <Milestone
              label="Together again"
              value={meetIn === 0 ? "Today" : String(meetIn)}
              unit={meetIn === 0 ? undefined : meetIn === 1 ? "day" : "days"}
              detail={meetIn === 0 ? "The waiting is over — you're together today." : longDate(ctx.relationship.nextMeetOn!)}
              world="us"
            />
          ) : (
            <Milestone label="Together again" value="—" detail="Set the next time you'll see each other, and every day until then counts down here." href="/settings#us" />
          )}
          {t ? (
            <Milestone
              label={`${ordinal(t.nextYears)} anniversary`}
              value={t.daysToAnniversary === 0 ? "Today" : String(t.daysToAnniversary)}
              unit={t.daysToAnniversary === 0 ? undefined : t.daysToAnniversary === 1 ? "day" : "days"}
              detail={t.daysToAnniversary === 0 ? `${t.nextYears} years of choosing each other.` : longDate(t.nextAnniversary)}
              progress={sinceLast / 365}
            />
          ) : (
            <Milestone label="Our anniversary" value="—" detail="Set the day it all began to count down to every anniversary." href="/settings#us" />
          )}
          {birthdays.map(({ m, b: bd }) => (
            <Milestone
              key={m.id}
              label={`${firstOf(m)}'s birthday`}
              value={bd.days === 0 ? "Today" : String(bd.days)}
              unit={bd.days === 0 ? undefined : bd.days === 1 ? "day" : "days"}
              detail={bd.days === 0 ? (m.id === ctx.me.id ? "Today is all about you." : "Make today unforgettable.") : longDate(bd.date)}
              progress={(365 - bd.days) / 365}
              world={m.theme}
            />
          ))}
        </div>
      </section>

      {/* ── RIGHT NOW ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl space-y-4 px-4 pt-10">
        {birthdayToday && (
          <div data-world={birthdayToday.m.theme} className="stage rise relative overflow-hidden rounded-[28px] px-6 py-10 text-center">
            <Starfield count={60} />
            <Avatar name={birthdayToday.m.displayName} url={birthdayToday.m.avatarUrl} theme={birthdayToday.m.theme} size={88} ring className="relative rounded-full" />
            <p className="font-lux relative mt-5 text-4xl font-medium text-[#f7efe1] sm:text-5xl">
              Happy birthday, <span className="gold-shimmer italic">{firstOf(birthdayToday.m)}</span>
            </p>
            <p className="relative mt-3 text-white/70">
              {birthdayToday.m.id === ctx.me.id ? "Another year on the road, and you're not walking it alone." : "Another year of the person you chose to walk beside. Make it one to remember."}
            </p>
          </div>
        )}
        <TogetherNow />
        <QuestionCard q={question} />
      </section>

      {/* ── A MOMENT FROM THE JOURNEY ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <SectionHead
          eyebrow={todayMemory ? "On this day" : "From our journey"}
          title={todayMemory ? `${yearsAgo} year${yearsAgo === 1 ? "" : "s"} ago today` : "Every step, remembered"}
          action={
            <Link href="/story" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
              The whole story <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        />
        {!moment && recent.length === 0 && media.length === 0 ? (
          <Link href="/story#add" className="stage lift mt-9 block rounded-[28px] px-8 py-16 text-center">
            <Starfield count={50} />
            <p className="font-lux relative text-4xl text-[#f7efe1]">Our first page is waiting.</p>
            <p className="relative mx-auto mt-3 max-w-md text-white/65">The day you met, a favourite date, a photo, somewhere you both want to go. Every journey is remembered one step at a time.</p>
            <span className="btn-gold relative mt-8">
              <IconHeart size={17} /> Write the first page
            </span>
          </Link>
        ) : (
          <div className="mt-9 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            {moment && (
              <Link
                href={moment.type === "photo" ? "/gallery" : "/story"}
                className={`group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[28px] ${momentPhoto ? "bg-night" : "stage"}`}
              >
                {momentPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private photo
                  <img src={momentPhoto} alt="" className="absolute inset-0 size-full object-cover transition duration-[1.6s] ease-out group-hover:scale-[1.04]" />
                ) : (
                  <>
                    <div className="aurora" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </div>
                    <Starfield count={70} />
                  </>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden />
                <div className="relative p-7 text-[#f7efe1] sm:p-9">
                  {moment.type === "memory" ? (
                    <>
                      <p className="eyebrow-lux">
                        {KIND[moment.row.m.kind] ?? "A memory"} · {day(moment.row.m.occurredOn)}
                      </p>
                      <p className="font-lux mt-4 text-[2.3rem] font-medium leading-[1.05] sm:text-[2.9rem]">{moment.row.m.title}</p>
                      {(moment.row.m.body ?? moment.row.m.why) && <p className="mt-3 line-clamp-3 max-w-xl text-white/75">{moment.row.m.body ?? moment.row.m.why}</p>}
                      <p className="mt-5 text-xs uppercase tracking-[0.24em] text-white/55">
                        {moment.row.m.place ? `${moment.row.m.place} · ` : ""}Kept by {firstOf({ displayName: moment.row.by })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow-lux">A moment · {day(moment.item.takenOn ?? moment.item.createdAt)}</p>
                      {moment.item.caption && <p className="font-lux mt-4 text-[2rem] font-medium leading-[1.1] sm:text-[2.5rem]">{moment.item.caption}</p>}
                      <p className="mt-4 text-xs uppercase tracking-[0.24em] text-white/55">Shared by {firstOf({ displayName: moment.item.by.name })}</p>
                    </>
                  )}
                </div>
              </Link>
            )}
            <div className={`flex flex-col gap-4 ${moment ? "" : "lg:col-span-2"}`}>
              {media.length > 0 && (
                <Link href="/gallery" className="grid auto-rows-[7.5rem] grid-cols-3 gap-1.5 overflow-hidden rounded-[24px]" aria-label="Open our gallery">
                  {media.slice(0, 5).map((p, i) => (
                    <span key={p.id} className={`relative block overflow-hidden bg-surface-2 ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private thumbnail */}
                      <img src={p.thumbUrl!} alt={p.caption ?? "From our gallery"} loading="lazy" decoding="async" className="size-full object-cover transition duration-700 hover:scale-105" />
                      {p.kind !== "photo" && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{p.kind === "song" ? "♪" : "▶"}</span>}
                      {p.isNew && <span className="absolute right-2 top-2 rounded-full bg-gold-2 px-2 py-0.5 text-[0.58rem] font-bold tracking-wider text-[#1a1206]">NEW</span>}
                    </span>
                  ))}
                </Link>
              )}
              <ol className="tile divide-y divide-line overflow-hidden">
                {recent.map(({ m, by, byTheme }) => (
                  <li key={m.id}>
                    <Link href="/story" className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2/60">
                      {m.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photoUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover" loading="lazy" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold" aria-hidden>
                          {m.kind === "plan" ? <IconCompass size={20} /> : m.kind === "discovery" ? <IconSparkle size={19} /> : <IconHeart size={19} />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-lux truncate text-xl font-medium leading-tight">{m.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {day(m.occurredOn)} · <span data-world={byTheme} className="text-accent">{by.split(" ")[0]}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
                {recent.length === 0 && (
                  <li className="px-5 py-6 text-sm text-muted">
                    <Link href="/story#add" className="text-accent underline-offset-4 hover:underline">
                      Add the first memory to our story →
                    </Link>
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}
      </section>

      {/* ── TWO WORLDS ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <SectionHead eyebrow="Two worlds, one orbit" title="Where each of us grows" />
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {members.map((m) => (
            <WorldCard key={m.id} person={m} topics={topicsBy.get(m.id) ?? []} />
          ))}
        </div>
      </section>

      {/* ── DISCOVERED TODAY ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <SectionHead eyebrow="Our shared world" title="Discovered today" />
        <p className="mt-3 max-w-2xl text-muted">Chosen each morning from what real sources published in the last few days. The same all day; something new tomorrow.</p>
        <div className="mt-9 grid gap-6 md:grid-cols-3">
          <Today title={`${firstOf(ctx.me)} · ${mainTopic(ctx.me.id) ? TOPICS[mainTopic(ctx.me.id)!].label : "Discovery"}`} item={mine} world={ctx.me.theme} />
          {partner && <Today title={`${firstOf(partner)} · ${mainTopic(partner.id) ? TOPICS[mainTopic(partner.id)!].label : "Discovery"}`} item={theirs} world={partner.theme} />}
          <Today title="For both of you" item={shared} world="us" />
        </div>
        <nav aria-label="Shared areas" className="tile mt-10 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/discover/nature", Icon: IconCompass, title: "Nature, together", text: "Wildlife, forests and fresh sightings in Kenya" },
            { href: "/discover/together", Icon: IconSparkle, title: "Something we both might like", text: "Where technology meets life" },
            { href: "/learning", Icon: IconImage, title: "Things we are learning", text: "Facts, books, documentaries, ideas" },
            { href: "/digest", Icon: IconHeart, title: "This week in our world", text: "What happened, what we found" },
          ].map(({ Icon, ...l }, i) => (
            <Link key={l.href} href={l.href} className={`group flex gap-4 p-6 transition hover:bg-surface-2/60 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "sm:border-l-0 sm:border-t lg:border-l lg:border-t-0" : ""} ${i === 3 ? "sm:border-t lg:border-t-0" : ""}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold">
                <Icon size={18} />
              </span>
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {l.title}
                  <IconArrowRight size={14} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-sm text-muted">{l.text}</span>
              </span>
            </Link>
          ))}
        </nav>
      </section>

      {/* ── CURIOUS TOGETHER ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <div className="tile relative overflow-hidden p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold-soft blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <div>
              <p className="eyebrow-lux">Curious together</p>
              <h2 className="font-lux mt-3 text-[2.2rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]">Research anything</h2>
              <p className="mt-3 max-w-md text-muted">Real studies read and cited, lessons that check you understood, and the simple version when that&apos;s all you need.</p>
            </div>
            <form action="/research" className="flex items-end gap-2 rounded-[1.4rem] border border-line bg-surface p-2 pl-4">
              <label htmlFor="home-research" className="sr-only">
                Ask a research question
              </label>
              <input id="home-research" name="q" required minLength={2} maxLength={2000} placeholder="What does the research say about…" className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.98rem] outline-none placeholder:text-muted/80" />
              <button className="btn shrink-0" aria-label="Research">
                <IconFlask size={16} />
                <span className="max-sm:hidden">Research</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── CLOSE ─────────────────────────────────────────────────── */}
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-24 text-center">
        <Monogram size={44} className="mx-auto" />
        <p className="font-lux mx-auto mt-6 max-w-xl text-[2rem] italic leading-tight sm:text-[2.4rem]">
          <span className="gold-deep">{vow.text}</span>
        </p>
        <p className="mt-5 text-[0.7rem] uppercase tracking-[0.32em] text-muted">
          {names}
          {ctx.relationship.startedOn ? ` · since ${new Date(`${ctx.relationship.startedOn}T12:00:00Z`).getUTCFullYear()}` : ""}
        </p>
      </footer>
    </div>
  );
}
