import Link from "next/link";
import { notFound } from "next/navigation";
import { worldPerson } from "@/lib/world-page";
import { projectList } from "@/lib/data";
import { deleteProject, saveProject } from "@/lib/actions/personal";
import { ActionForm, ConfirmButton, Field, VisibilityBadge, VisibilitySelect } from "@/components/ui/forms";
import { day } from "@/lib/ui/time";

export const metadata = { title: "Things I'm Building" };

const STATUS: Record<string, string> = { idea: "💭 Idea", building: "🛠️ Building", live: "🟢 Live", paused: "⏸ Paused", archived: "📦 Archived" };

export default async function ProjectsPage({ params, searchParams }: PageProps<"/world/[slug]/projects">) {
  const { ctx, person, own, first } = await worldPerson(params);
  if (!person.features.includes("projects")) notFound();
  const { edit } = await searchParams;
  const list = await projectList(ctx, person.id);
  const editing = own && typeof edit === "string" ? list.find((p) => p.id === edit) : undefined;
  const base = `/world/${person.slug}/projects`;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
      <div>
        <h2 className="font-display text-2xl font-semibold">Things I&apos;m Building</h2>
        <p className="mt-1 text-muted">{own ? "Private experiments and public showcases, side by side. Visibility decides which is which." : `What ${first} is building.`}</p>
        <div className="mt-6 space-y-5">
          {list.map((p) => (
            <article key={p.id} className="card overflow-hidden">
              {p.screenshots[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.screenshots[0]} alt={`${p.name} screenshot`} loading="lazy" className="max-h-80 w-full object-cover object-top" />
              )}
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="chip">{STATUS[p.status] ?? p.status}</span>
                  {p.current && <span className="chip">⭐ Current</span>}
                  <VisibilityBadge v={p.visibility} />
                  {p.startedOn && <span>Started {day(p.startedOn)}</span>}
                  <span>· Updated {day(p.updatedAt)}</span>
                </div>
                <h3 className="font-display mt-2 text-2xl font-semibold">{p.name}</h3>
                {p.description && <p className="mt-1 leading-relaxed">{p.description}</p>}
                {p.stack.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5 font-mono text-xs">
                    {p.stack.map((s) => (
                      <li key={s} className="rounded-md border border-line px-2 py-0.5">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ["The problem", p.problem],
                    ["Architecture", p.architecture],
                    ["Lessons learned", p.lessons],
                    ["Future improvements", p.improvements],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-semibold">{k}</dt>
                        <dd className="whitespace-pre-line text-muted">{v}</dd>
                      </div>
                    ))}
                </dl>
                {p.screenshots.length > 1 && (
                  <div className="mt-4 flex gap-2 overflow-x-auto">
                    {p.screenshots.slice(1).map((s) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={s} src={s} alt="" loading="lazy" className="h-28 rounded-lg border border-line object-cover" />
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  {p.repoUrl && (
                    <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                      Repository →
                    </a>
                  )}
                  {p.liveUrl && (
                    <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                      Live site →
                    </a>
                  )}
                  {own && (
                    <span className="ml-auto flex gap-3">
                      <Link href={`${base}?edit=${p.id}`} className="text-xs text-muted hover:text-ink">
                        Edit
                      </Link>
                      <ConfirmButton onConfirm={deleteProject.bind(null, p.id)} question={`Delete ${p.name}?`} />
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
          {list.length === 0 && <p className="card p-8 text-center text-muted">No projects shared yet.</p>}
        </div>
      </div>

      {own && (
        <aside>
          <div className="card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto p-5">
            <h2 className="font-display text-xl font-semibold">{editing ? `Edit ${editing.name}` : "New project"}</h2>
            {editing && (
              <Link href={base} className="text-xs text-muted underline">
                Cancel editing
              </Link>
            )}
            <ActionForm key={editing?.id ?? "new"} action={saveProject} submit={editing ? "Update" : "Add project"} resetOnSuccess={!editing} className="mt-3 space-y-3">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Name" name="name">
                <input id="name" name="name" required defaultValue={editing?.name} className="field" />
              </Field>
              <Field label="Description" name="description">
                <textarea id="description" name="description" defaultValue={editing?.description ?? ""} className="field min-h-16" />
              </Field>
              <Field label="Problem being solved" name="problem">
                <textarea id="problem" name="problem" defaultValue={editing?.problem ?? ""} className="field min-h-16" />
              </Field>
              <Field label="Technology stack" name="stack" hint="(comma separated)">
                <input id="stack" name="stack" defaultValue={editing?.stack.join(", ")} className="field" />
              </Field>
              <Field label="Architecture" name="architecture">
                <textarea id="architecture" name="architecture" defaultValue={editing?.architecture ?? ""} className="field min-h-16" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status" name="status">
                  <select id="status" name="status" defaultValue={editing?.status ?? "building"} className="field">
                    {Object.entries(STATUS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Started" name="startedOn">
                  <input id="startedOn" name="startedOn" type="date" defaultValue={editing?.startedOn ?? ""} className="field" />
                </Field>
              </div>
              <Field label="Repository link" name="repoUrl">
                <input id="repoUrl" name="repoUrl" type="url" defaultValue={editing?.repoUrl ?? ""} className="field" />
              </Field>
              <Field label="Live URL" name="liveUrl">
                <input id="liveUrl" name="liveUrl" type="url" defaultValue={editing?.liveUrl ?? ""} className="field" />
              </Field>
              <Field label="Screenshot links" name="screenshots" hint="(comma separated https://…)">
                <textarea id="screenshots" name="screenshots" defaultValue={editing?.screenshots.join(", ")} className="field min-h-12" />
              </Field>
              <Field label="Lessons learned" name="lessons">
                <textarea id="lessons" name="lessons" defaultValue={editing?.lessons ?? ""} className="field min-h-16" />
              </Field>
              <Field label="Future improvements" name="improvements">
                <textarea id="improvements" name="improvements" defaultValue={editing?.improvements ?? ""} className="field min-h-16" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="current" defaultChecked={editing?.current} /> This is my current project
              </label>
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
