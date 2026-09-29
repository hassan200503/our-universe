"use client";

import { useActionState, useState } from "react";
import { answerToday } from "@/lib/actions/together";
import type { DailyQuestion } from "@/lib/together/daily";
import { Avatar } from "@/components/avatar";
import { useMembers } from "@/components/me-context";

/** Today's question, written like a letter: each answer stays sealed until you've both written yours. */
export function QuestionCard({ q }: { q: DailyQuestion }) {
  const members = useMembers();
  const [editing, setEditing] = useState(!q.mine);
  const [state, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const r = await answerToday(s, fd);
    if (r.ok) setEditing(false);
    return r;
  }, null);
  const partner = members[1];
  const partnerFirst = partner?.displayName.split(" ")[0] ?? "They";
  return (
    <section className="tile relative overflow-hidden p-6 sm:p-9">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(circle,var(--gold-soft),transparent_70%)]" aria-hidden />
      <p className="eyebrow-lux relative">Today&apos;s question</p>
      <h2 className="font-lux relative mt-4 max-w-3xl text-[1.9rem] font-medium leading-[1.12] tracking-tight sm:text-[2.4rem]">{q.question}</h2>
      {editing ? (
        <form action={action} className="relative mt-6">
          <textarea name="answer" defaultValue={q.mine ?? ""} required maxLength={1500} className="field min-h-28 text-base" placeholder="Write your answer…" aria-label="Your answer" />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button className="btn" disabled={pending} data-world="us">
              {pending ? "Sealing…" : q.mine ? "Update my answer" : "Seal my answer"}
            </button>
            <p className="text-xs text-muted">{q.partnerAnswered ? `${partnerFirst} already answered — yours unlocks theirs.` : "Answers stay sealed until you've both written yours."}</p>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>
        </form>
      ) : (
        <div className="relative mt-6 grid gap-4 md:grid-cols-2">
          <figure className="rounded-2xl border border-line bg-surface-2/60 p-5">
            <blockquote className="font-lux text-xl leading-snug">“{q.mine}”</blockquote>
            <figcaption className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Avatar name={members[0]?.displayName ?? ""} url={members[0]?.avatarUrl} theme={members[0]?.theme ?? "us"} size={22} /> You
            </figcaption>
          </figure>
          {q.theirs.map((t) => {
            const m = members.find((x) => x.slug === t.slug);
            return (
              <figure key={t.slug} data-world={m?.theme} className="rounded-2xl border border-accent/20 bg-accent-soft/50 p-5">
                <blockquote className="font-lux text-xl leading-snug">“{t.answer}”</blockquote>
                <figcaption className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <Avatar name={m?.displayName ?? ""} url={m?.avatarUrl} theme={m?.theme ?? "us"} size={22} /> {m?.displayName.split(" ")[0]}
                </figcaption>
              </figure>
            );
          })}
          {!q.theirs.length && (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">
              Waiting for {partnerFirst}… their answer appears here the moment it&apos;s written.
            </div>
          )}
          <button className="justify-self-start text-xs text-muted underline-offset-4 hover:underline" onClick={() => setEditing(true)}>
            Edit my answer
          </button>
        </div>
      )}
    </section>
  );
}
