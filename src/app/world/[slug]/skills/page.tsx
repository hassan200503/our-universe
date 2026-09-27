import Link from "next/link";
import { worldPerson } from "@/lib/world-page";
import { skillList } from "@/lib/data";
import { visibleTo } from "@/lib/context";
import { deleteSkill, saveSkill } from "@/lib/actions/personal";
import { Meter, SCALE } from "@/components/ui/meter";
import { ActionForm, ConfirmButton, Field, VisibilityBadge, VisibilitySelect } from "@/components/ui/forms";

export const metadata = { title: "Skills" };

export default async function SkillsPage({ params, searchParams }: PageProps<"/world/[slug]/skills">) {
  const { ctx, person, own, first } = await worldPerson(params);
  const { edit } = await searchParams;
  const list = await skillList(person.id, visibleTo(ctx, person.id));
  const editing = own && typeof edit === "string" ? list.find((s) => s.id === edit) : undefined;
  const primary = list.filter((s) => s.primary);
  const groups = new Map<string, typeof list>();
  for (const s of list.filter((x) => !x.primary)) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category)!.push(s);
  }
  const base = `/world/${person.slug}/skills`;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <h2 className="font-display text-2xl font-semibold">Skills</h2>
        <p className="mt-1 max-w-2xl text-muted">
          Rated honestly on a five-point scale, each with the evidence behind it. {own ? "Edit anything as you grow." : ""}
        </p>
        {list.length === 0 && <p className="card mt-6 p-8 text-center text-muted">{own ? "Add your first skill →" : `${first} hasn't added skills yet.`}</p>}
        {primary.map((s) => (
          <div key={s.id} className="card mt-6 p-6">
            <p className="eyebrow">Primary skill</p>
            <p className="font-display mt-1 text-2xl font-semibold">{s.name}</p>
            <div className="mt-2">
              <Meter level={s.level} />
            </div>
            {s.evidence && <p className="mt-3 text-muted">{s.evidence}</p>}
          </div>
        ))}
        {[...groups.entries()].map(([cat, items]) => (
          <section key={cat} className="mt-8">
            <h3 className="font-display text-lg font-semibold">{cat}</h3>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {items.map((s) => (
                <li key={s.id} className="grid gap-2 p-4 sm:grid-cols-[14rem_7rem_1fr] sm:items-baseline">
                  <span className="font-semibold">{s.name}</span>
                  <Meter level={s.level} />
                  <span className="text-sm text-muted">
                    {s.evidence}
                    {own && (
                      <span className="mt-1 flex gap-3">
                        <VisibilityBadge v={s.visibility} />
                        <Link href={`${base}?edit=${s.id}`} className="text-xs hover:text-ink">
                          Edit
                        </Link>
                        <ConfirmButton onConfirm={deleteSkill.bind(null, s.id)} question={`Remove ${s.name}?`} label="Remove" />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <details className="mt-8 text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-ink">What the ratings mean</summary>
          <ol className="mt-2 space-y-1">
            {SCALE.slice(1).map((d, i) => (
              <li key={i}>
                <Meter level={i + 1} /> {d}
              </li>
            ))}
          </ol>
        </details>
      </div>
      {own && (
        <aside>
          <div className="card sticky top-20 p-5">
            <h2 className="font-display text-xl font-semibold">{editing ? `Edit ${editing.name}` : "Add a skill"}</h2>
            {editing && (
              <Link href={base} className="text-xs text-muted underline">
                Cancel editing
              </Link>
            )}
            <ActionForm key={editing?.id ?? "new"} action={saveSkill} submit={editing ? "Update" : "Add"} resetOnSuccess={!editing} className="mt-3 space-y-3">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Skill" name="name">
                <input id="name" name="name" required defaultValue={editing?.name} className="field" />
              </Field>
              <Field label="Category" name="category">
                <input id="category" name="category" required defaultValue={editing?.category} list="skill-cats" className="field" />
                <datalist id="skill-cats">
                  {[...groups.keys()].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Level (1–5)" name="level">
                <select id="level" name="level" defaultValue={editing?.level ?? 3} className="field">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      {l} — {SCALE[l]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Evidence" name="evidence" hint="(what you built with it)">
                <textarea id="evidence" name="evidence" defaultValue={editing?.evidence ?? ""} className="field" />
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
