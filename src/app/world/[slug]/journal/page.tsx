import Link from "next/link";
import { worldPerson } from "@/lib/world-page";
import { journal, projectList } from "@/lib/data";
import { deleteLearningRecord, saveLearningRecord } from "@/lib/actions/personal";
import { kindLabel, worldFor } from "@/lib/worlds";
import { ActionForm, ConfirmButton, Field, VisibilityBadge, VisibilitySelect } from "@/components/ui/forms";
import { day, isoDay } from "@/lib/ui/time";

export const metadata = { title: "Journey" };

const STATUS: Record<string, string> = { idea: "💭 Idea", "in-progress": "🔄 In progress", done: "✅ Done", parked: "⏸ Parked" };

export default async function JournalPage({ params, searchParams }: PageProps<"/world/[slug]/journal">) {
  const { ctx, person, own, first } = await worldPerson(params);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;
  const cfg = worldFor(person.theme);
  const [entries, projects] = await Promise.all([journal(ctx, person.id, { q, kind }), person.features.includes("projects") ? projectList(ctx, person.id) : Promise.resolve([])]);
  const editing = own && editId ? (await journal(ctx, person.id)).find((e) => e.id === editId) : undefined;
  const base = `/world/${person.slug}/journal`;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
      <div>
        <h2 className="font-display text-2xl font-semibold">{person.journalTitle}</h2>
        <p className="mt-1 text-muted">
          {own ? "What you're learning, building, solving and wondering about." : `What ${first} is learning and working through.`}
        </p>
        <form className="mt-4 flex flex-wrap gap-2" action={base}>
          <input name="q" defaultValue={q} placeholder="Search titles, notes, tags…" className="field max-w-xs" aria-label="Search the journal" />
          <select name="kind" defaultValue={kind ?? ""} className="field w-auto" aria-label="Filter by kind">
            <option value="">All kinds</option>
            {cfg.journalKinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost">Filter</button>
        </form>

        {entries.length === 0 ? (
          <p className="card mt-6 p-8 text-center text-muted">{q || kind ? "Nothing matches that filter." : own ? "Your first entry goes on the right →" : `${first} hasn't shared any entries yet.`}</p>
        ) : (
          <ol className="mt-6 space-y-4">
            {entries.map((e) => (
              <li key={e.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="chip">{kindLabel(cfg.journalKinds, e.kind)}</span>
                  <span>{day(e.occurredOn)}</span>
                  <span>{STATUS[e.status] ?? e.status}</span>
                  {e.difficulty && <span>· {e.difficulty}</span>}
                  <VisibilityBadge v={e.visibility} />
                </div>
                <h3 className="font-display mt-2 text-lg font-semibold">{e.title}</h3>
                {e.description && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{e.description}</p>}
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[7rem_1fr]">
                  {e.category && (
                    <>
                      <dt className="text-muted">Category</dt>
                      <dd>{e.category}</dd>
                    </>
                  )}
                  {e.technology && (
                    <>
                      <dt className="text-muted">{person.theme === "whitney" ? "Technique / field" : "Technology"}</dt>
                      <dd>{e.technology}</dd>
                    </>
                  )}
                  {e.source && (
                    <>
                      <dt className="text-muted">Source</dt>
                      <dd>{/^https?:\/\//.test(e.source) ? <a className="text-accent underline" href={e.source} target="_blank" rel="noopener noreferrer">{e.source}</a> : e.source}</dd>
                    </>
                  )}
                  {e.projectId && (
                    <>
                      <dt className="text-muted">Project</dt>
                      <dd>{projects.find((p) => p.id === e.projectId)?.name}</dd>
                    </>
                  )}
                </dl>
                {e.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm">{e.notes}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {e.tags.map((t) => (
                    <Link key={t} href={`${base}?q=${encodeURIComponent(t)}`} className="text-xs text-muted hover:text-accent">
                      #{t}
                    </Link>
                  ))}
                  {own && (
                    <span className="ml-auto flex gap-3">
                      <Link href={`${base}?edit=${e.id}`} className="text-xs text-muted hover:text-ink">
                        Edit
                      </Link>
                      <ConfirmButton onConfirm={deleteLearningRecord.bind(null, e.id)} question="Delete this entry?" />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {own && (
        <aside>
          <div className="card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto p-5">
            <h2 className="font-display text-xl font-semibold">{editing ? "Edit entry" : "New entry"}</h2>
            {editing && (
              <Link href={base} className="text-xs text-muted underline">
                Cancel editing
              </Link>
            )}
            <ActionForm key={editing?.id ?? "new"} action={saveLearningRecord} submit={editing ? "Update" : "Add"} resetOnSuccess={!editing} className="mt-3 space-y-3">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Kind" name="kind">
                <select id="kind" name="kind" className="field" defaultValue={editing?.kind ?? cfg.journalKinds[0].value}>
                  {cfg.journalKinds.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" name="title">
                <input id="title" name="title" required defaultValue={editing?.title} className="field" />
              </Field>
              <Field label="Description" name="description">
                <textarea id="description" name="description" defaultValue={editing?.description ?? ""} className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" name="occurredOn">
                  <input id="occurredOn" name="occurredOn" type="date" defaultValue={editing?.occurredOn ?? isoDay()} className="field" />
                </Field>
                <Field label="Status" name="status">
                  <select id="status" name="status" defaultValue={editing?.status ?? "in-progress"} className="field">
                    {Object.entries(STATUS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category" name="category">
                  <input id="category" name="category" defaultValue={editing?.category ?? ""} className="field" />
                </Field>
                <Field label="Difficulty" name="difficulty">
                  <select id="difficulty" name="difficulty" defaultValue={editing?.difficulty ?? ""} className="field">
                    <option value="">—</option>
                    <option value="gentle">Gentle</option>
                    <option value="moderate">Moderate</option>
                    <option value="hard">Hard</option>
                    <option value="brutal">Brutal</option>
                  </select>
                </Field>
              </div>
              <Field label={person.theme === "whitney" ? "Technique / field" : "Technology"} name="technology">
                <input id="technology" name="technology" defaultValue={editing?.technology ?? ""} className="field" />
              </Field>
              <Field label="Tags" name="tags" hint="(comma separated)">
                <input id="tags" name="tags" defaultValue={editing?.tags.join(", ")} className="field" />
              </Field>
              <Field label="Source" name="source" hint="(book, course, link…)">
                <input id="source" name="source" defaultValue={editing?.source ?? ""} className="field" />
              </Field>
              {projects.length > 0 && (
                <Field label="Related project" name="projectId">
                  <select id="projectId" name="projectId" defaultValue={editing?.projectId ?? ""} className="field">
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Notes" name="notes">
                <textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} className="field" />
              </Field>
              <Field label="Who can see this" name="visibility">
                <VisibilitySelect defaultValue={editing?.visibility ?? "shared"} />
              </Field>
            </ActionForm>
          </div>
        </aside>
      )}
    </div>
  );
}
