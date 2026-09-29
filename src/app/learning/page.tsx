import Link from "next/link";
import { requireCtx } from "@/lib/context";
import { learningTogether } from "@/lib/data";
import { addSharedLearning, deleteSharedLearning, toggleLearningFavorite } from "@/lib/actions/shared";
import { ActionButton, ActionForm, ConfirmButton, Field } from "@/components/ui/forms";
import { Container, PageHeader } from "@/components/ui/page-header";
import { day, isoDay } from "@/lib/ui/time";

export const metadata = { title: "Things We Are Learning" };

const TOPICS = ["Science", "Technology", "Nature", "Philosophy", "Biotechnology", "Birds", "Knitting", "A book", "A documentary", "An article", "Something funny"];

export default async function LearningPage() {
  const ctx = await requireCtx();
  const rows = await learningTogether(ctx);
  return (
    <>
      <PageHeader world="us" eyebrow="Shared learning 📚" title="Things we are learning">
        A shared notebook for anything either of us found worth knowing — a scientific idea, a new technology, a nature fact, a philosophical idea, a book, a documentary, or
        something that just made us laugh.
        <Link href="/research" className="btn btn-ghost mt-4 text-sm">
          Research something new →
        </Link>
      </PageHeader>
      <Container world="us">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div>
            {rows.length === 0 ? (
              <p className="card p-10 text-center text-muted">Nothing yet. What did you learn this week?</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {rows.map(({ l, by, byTheme }) => (
                  <li key={l.id} className="card flex flex-col p-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {l.topic && <span className="chip">{l.topic}</span>}
                      <span>{day(l.occurredOn)}</span>
                      <span data-world={byTheme} className="ml-auto font-semibold text-accent">
                        {by.split(" ")[0]}
                      </span>
                    </div>
                    <h2 className="font-display mt-2 text-lg font-semibold leading-snug">{l.title}</h2>
                    {l.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted">{l.notes}</p>}
                    <div className="mt-auto flex items-center gap-3 pt-3 text-sm">
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {l.source ?? "Source"} →
                        </a>
                      ) : (
                        l.source && <span className="text-xs text-muted">— {l.source}</span>
                      )}
                      <ActionButton onClick={toggleLearningFavorite.bind(null, l.id)} className={`ml-auto ${l.favorite ? "" : "opacity-40 grayscale"}`}>
                        <span aria-label={l.favorite ? "Unfavourite" : "Favourite"}>⭐</span>
                      </ActionButton>
                      <ConfirmButton onConfirm={deleteSharedLearning.bind(null, l.id)} question="Remove this?" label="Remove" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside>
            <div className="card sticky top-20 p-5">
              <h2 className="font-display text-xl font-semibold">I learned something</h2>
              <ActionForm action={addSharedLearning} submit="Share it" className="mt-3 space-y-3">
                <Field label="What?" name="title">
                  <input id="title" name="title" required className="field" />
                </Field>
                <Field label="Topic" name="topic">
                  <input id="topic" name="topic" list="learning-topics" className="field" />
                  <datalist id="learning-topics">
                    {TOPICS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Notes" name="notes" hint="(optional)">
                  <textarea id="notes" name="notes" className="field" />
                </Field>
                <Field label="Source" name="source" hint="(optional)">
                  <input id="source" name="source" className="field" />
                </Field>
                <Field label="Link" name="url" hint="(optional)">
                  <input id="url" name="url" type="url" className="field" />
                </Field>
                <Field label="Date" name="occurredOn">
                  <input id="occurredOn" name="occurredOn" type="date" defaultValue={isoDay()} className="field" />
                </Field>
              </ActionForm>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
