"use client";

import { useActionState, useState } from "react";
import { answerToday } from "@/lib/actions/together";
import type { DailyQuestion } from "@/lib/together/daily";
import { Avatar } from "@/components/avatar";
import { useMembers } from "@/components/me-context";

export function QuestionCard({ q }: { q: DailyQuestion }) {
  const members = useMembers();
  const [editing, setEditing] = useState(!q.mine);
  const [state, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const r = await answerToday(s, fd);
    if (r.ok) setEditing(false);
    return r;
  }, null);
  const partner = members[1];
  return (
    <section data-world="us" className="card-glow p-6">
      <p className="eyebrow">Question of the day 💌</p>
      <h2 className="font-display mt-2 text-2xl font-semibold leading-snug">{q.question}</h2>
      {editing ? (
        <form action={action} className="mt-4">
          <textarea name="answer" defaultValue={q.mine ?? ""} required maxLength={1500} className="field min-h-24" placeholder="Your answer…" aria-label="Your answer" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn" disabled={pending}>
              {pending ? "Sending…" : q.mine ? "Update my answer" : "Answer"}
            </button>
            <p className="text-xs text-muted">{q.partnerAnswered ? `${partner?.displayName.split(" ")[0] ?? "They"} already answered — yours unlocks theirs.` : "Their answer stays hidden until you've both written yours."}</p>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex gap-3">
            <Avatar name={members[0]?.displayName ?? ""} url={members[0]?.avatarUrl} theme={members[0]?.theme ?? "us"} size={32} />
            <p className="rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-2.5 text-sm">{q.mine}</p>
          </div>
          {q.theirs.map((t) => {
            const m = members.find((x) => x.slug === t.slug);
            return (
              <div key={t.slug} className="flex justify-end gap-3">
                <p data-world={m?.theme} className="rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-accent-ink">
                  {t.answer}
                </p>
                <Avatar name={m?.displayName ?? ""} url={m?.avatarUrl} theme={m?.theme ?? "us"} size={32} />
              </div>
            );
          })}
          {!q.theirs.length && <p className="text-sm text-muted">Waiting for {partner?.displayName.split(" ")[0] ?? "them"}… you&apos;ll both see each other&apos;s answers here.</p>}
          <button className="text-xs text-muted underline" onClick={() => setEditing(true)}>
            Edit my answer
          </button>
        </div>
      )}
    </section>
  );
}
