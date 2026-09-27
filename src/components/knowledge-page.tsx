import Link from "next/link";
import type { Ctx, PublicPerson } from "@/lib/context";
import { knowledge } from "@/lib/data";
import { deleteKnowledge, saveKnowledge } from "@/lib/actions/personal";
import { kindLabel } from "@/lib/worlds";
import { ActionForm, ConfirmButton, Field, VisibilityBadge, VisibilitySelect } from "@/components/ui/forms";
import { day } from "@/lib/ui/time";

/** Shared page body for the Knowledge Vault and the philosophy thinking journal. */
export async function KnowledgePage({
  ctx,
  person,
  own,
  space,
  kinds,
  title,
  intro,
  q,
  tag,
  emptyOwn,
}: {
  ctx: Ctx;
  person: PublicPerson;
  own: boolean;
  space: "vault" | "thinking";
  kinds: { value: string; label: string }[];
  title: string;
  intro: string;
  q?: string;
  tag?: string;
  emptyOwn: string;
}) {
  const entries = await knowledge(ctx, person.id, space, { q, tag });
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  const base = `/world/${person.slug}/${space}`;
  const first = person.displayName.split(" ")[0];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-muted">{intro}</p>
        <form action={base} className="mt-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search…" aria-label="Search" className="field max-w-xs" />
          <button className="btn btn-ghost">Search</button>
          {(q || tag) && (
            <Link href={base} className="self-center text-sm text-muted underline">
              Clear
            </Link>
          )}
        </form>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Link key={t} href={`${base}?tag=${encodeURIComponent(t)}`} className={`chip ${tag === t ? "ring-1 ring-accent" : "bg-transparent text-muted"}`}>
                #{t}
              </Link>
            ))}
          </div>
        )}
        {entries.length === 0 ? (
          <p className="card mt-6 p-8 text-center text-muted">{q || tag ? "Nothing matches." : own ? emptyOwn : `${first} hasn't shared anything here.`}</p>
        ) : (
          <div className="mt-6 columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
            {entries.map((e) => (
              <article key={e.id} className={`card break-inside-avoid p-4 ${e.kind === "quote" ? "border-l-4 border-l-accent" : ""}`}>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{kindLabel(kinds, e.kind)}</span>
                  <span>· {day(e.createdAt)}</span>
                  <VisibilityBadge v={e.visibility} />
                </div>
                <h3 className={`mt-2 font-semibold leading-snug ${e.kind === "quote" ? "font-display text-lg italic" : ""}`}>{e.kind === "quote" ? `“${e.title}”` : e.title}</h3>
                {e.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{e.body}</p>}
                {(e.source || e.url) && (
                  <p className="mt-2 text-xs">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {e.source ?? "Source"} →
                      </a>
                    ) : (
                      <span className="text-muted">— {e.source}</span>
                    )}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {e.tags.map((t) => (
                    <span key={t} className="text-xs text-muted">
                      #{t}
                    </span>
                  ))}
                  {own && <ConfirmButton className="ml-auto" onConfirm={deleteKnowledge.bind(null, e.id)} question="Delete this?" />}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {own && (
        <aside>
          <div className="card sticky top-20 p-5">
            <h2 className="font-display text-xl font-semibold">Add</h2>
            <ActionForm action={saveKnowledge} submit="Save" className="mt-3 space-y-3">
              <input type="hidden" name="space" value={space} />
              <Field label="Kind" name="kind">
                <select id="kind" name="kind" className="field">
                  {kinds.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={space === "thinking" ? "The question, idea or quote" : "Title"} name="title">
                <textarea id="title" name="title" required className="field min-h-14" />
              </Field>
              <Field label={space === "thinking" ? "Thoughts" : "Notes"} name="body" hint="(optional — no need for answers)">
                <textarea id="body" name="body" className="field" />
              </Field>
              <Field label={space === "thinking" ? "Philosopher / book / source" : "Source"} name="source" hint="(optional)">
                <input id="source" name="source" className="field" />
              </Field>
              <Field label="Link" name="url" hint="(optional)">
                <input id="url" name="url" type="url" className="field" />
              </Field>
              <Field label="Tags" name="tags" hint="(comma separated)">
                <input id="tags" name="tags" className="field" />
              </Field>
              <Field label="Who can see this" name="visibility">
                <VisibilitySelect defaultValue="private" />
              </Field>
            </ActionForm>
          </div>
        </aside>
      )}
    </div>
  );
}
