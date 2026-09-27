import Link from "next/link";
import { requireCtx } from "@/lib/context";
import { story } from "@/lib/data";
import { addMemory, deleteMemory, togglePlanDone } from "@/lib/actions/shared";
import { ActionButton, ActionForm, ConfirmButton, Field } from "@/components/ui/forms";
import { Container, PageHeader } from "@/components/ui/page-header";
import { day, isoDay } from "@/lib/ui/time";

export const metadata = { title: "Our Story" };

const KINDS = [
  { k: null, label: "Everything" },
  { k: "memory", label: "❤️ Memories" },
  { k: "milestone", label: "🌹 Milestones" },
  { k: "adventure", label: "🧭 Adventures" },
  { k: "plan", label: "🗺️ Plans" },
  { k: "discovery", label: "✨ Discoveries" },
];
const ICON: Record<string, string> = { memory: "❤️", milestone: "🌹", adventure: "🧭", plan: "🗺️", discovery: "✨" };

export default async function StoryPage({ searchParams }: PageProps<"/story">) {
  const ctx = await requireCtx();
  const { kind } = await searchParams;
  const k = typeof kind === "string" && KINDS.some((x) => x.k === kind) ? kind : undefined;
  const rows = await story(ctx, { kind: k });
  const plans = k ? [] : rows.filter((r) => r.m.kind === "plan" && !r.m.planDone);

  // Group the timeline by year and month so it reads like a story, not a table.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = new Date(r.m.occurredOn).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <>
      <PageHeader world="us" eyebrow="Our Story ❤️" title="Everything we've lived, and everything ahead">
        Memories, milestones, adventures and plans — plus the discoveries either of us saved to share. It grows every time one of us adds to it.
      </PageHeader>
      <Container world="us">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((x) => (
                <Link key={x.label} href={x.k ? `/story?kind=${x.k}` : "/story"} className={`chip ${k === (x.k ?? undefined) ? "ring-1 ring-accent" : "bg-transparent text-muted"}`}>
                  {x.label}
                </Link>
              ))}
            </div>

            {plans.length > 0 && (
              <section className="mt-6">
                <h2 className="font-display text-xl font-semibold">Still ahead of us</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {plans.map(({ m }) => (
                    <li key={m.id} className="card flex items-center gap-3 p-3">
                      <ActionButton onClick={togglePlanDone.bind(null, m.id)} className="grid size-6 place-items-center rounded-full border border-accent text-xs">
                        <span className="sr-only">Mark done</span>
                      </ActionButton>
                      <span className="text-sm">
                        {m.title}
                        <span className="block text-xs text-muted">{day(m.occurredOn)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {rows.length === 0 ? (
              <div className="card mt-6 p-10 text-center">
                <p className="text-4xl" aria-hidden>
                  🌹
                </p>
                <p className="font-display mt-3 text-xl font-semibold">The first page of our story</p>
                <p className="mx-auto mt-1 max-w-sm text-muted">Add the day we met, a favourite date, or somewhere we want to go. You can also save any discovery here with “Save to Our Story”.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-10">
                {[...groups.entries()].map(([label, items]) => (
                  <section key={label}>
                    <h2 className="font-display sticky top-14 z-10 bg-bg/90 py-2 text-lg font-semibold backdrop-blur">{label}</h2>
                    <ol className="relative mt-2 space-y-4 border-l-2 border-accent-soft pl-6">
                      {items.map(({ m, by, byTheme, sourceUrl, sourceName }) => (
                        <li key={m.id} className="relative">
                          <span className="absolute -left-[2.15rem] top-3 grid size-7 place-items-center rounded-full bg-surface text-sm ring-2 ring-accent-soft" aria-hidden>
                            {ICON[m.kind] ?? "❤️"}
                          </span>
                          <article className="card overflow-hidden">
                            {m.photoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.photoUrl} alt="" loading="lazy" className="max-h-72 w-full object-cover" />
                            )}
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className={`font-display text-lg font-semibold ${m.kind === "plan" && m.planDone ? "line-through opacity-60" : ""}`}>{m.title}</h3>
                                <ConfirmButton onConfirm={deleteMemory.bind(null, m.id)} question="Remove this from our story?" label="Remove" />
                              </div>
                              <p className="text-xs text-muted">
                                {day(m.occurredOn)}
                                {m.place ? ` · ${m.place}` : ""} · added by <span data-world={byTheme} className="text-accent">{by.split(" ")[0]}</span>
                              </p>
                              {m.why && (
                                <p className="mt-3 text-sm">
                                  <span className="font-semibold">Why it caught {by.split(" ")[0]}&apos;s eye: </span>
                                  {m.why}
                                </p>
                              )}
                              {m.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{m.body}</p>}
                              {sourceUrl && (
                                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
                                  From {sourceName} →
                                </a>
                              )}
                              {m.kind === "plan" && (
                                <ActionButton onClick={togglePlanDone.bind(null, m.id)} className="btn btn-ghost mt-3 px-3 py-1 text-xs">
                                  {m.planDone ? "Mark as still ahead" : "We did it ✓"}
                                </ActionButton>
                              )}
                            </div>
                          </article>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </div>

          <aside>
            <div className="card sticky top-20 p-5">
              <h2 className="font-display text-xl font-semibold">Add to our story</h2>
              <ActionForm action={addMemory} submit="Keep it" className="mt-3 space-y-3">
                <Field label="What kind?" name="kind">
                  <select id="kind" name="kind" className="field" defaultValue="memory">
                    <option value="memory">❤️ A memory</option>
                    <option value="milestone">🌹 A milestone</option>
                    <option value="adventure">🧭 An adventure</option>
                    <option value="plan">🗺️ A plan for the future</option>
                  </select>
                </Field>
                <Field label="Title" name="title">
                  <input id="title" name="title" required className="field" placeholder="e.g. The day we met" />
                </Field>
                <Field label="Date" name="occurredOn">
                  <input id="occurredOn" name="occurredOn" type="date" defaultValue={isoDay()} className="field" />
                </Field>
                <Field label="Where" name="place" hint="(optional)">
                  <input id="place" name="place" className="field" />
                </Field>
                <Field label="The story" name="body" hint="(optional)">
                  <textarea id="body" name="body" className="field" />
                </Field>
                <Field label="Photo link" name="photoUrl" hint="(optional, https://…)">
                  <input id="photoUrl" name="photoUrl" type="url" className="field" />
                </Field>
              </ActionForm>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
