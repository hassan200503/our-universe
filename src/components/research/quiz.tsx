"use client";

import { useEffect, useRef, useState } from "react";
import type { Quiz } from "@/lib/research/types";
import { IconCheck, IconX } from "@/components/icons";

/** Five questions on what a thread covered, one at a time, with the reasoning after each answer. */
export function QuizDialog({ threadId, title, onClose }: { threadId: string; title: string; onClose: () => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/research/${threadId}/quiz`, { method: "POST", signal: ctl.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (Quiz & { error?: string }) | null;
        if (!res.ok || !body?.questions?.length) throw new Error(body?.error ?? "The quiz couldn't be written just now. Try again in a moment.");
        setQuiz(body);
        setPicks(body.questions.map(() => null));
      })
      .catch((e: unknown) => {
        if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : "The quiz couldn't be written just now.");
      });
    return () => ctl.abort();
  }, [threadId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const q = quiz?.questions[i];
  const picked = picks[i] ?? null;
  const done = !!quiz && i >= quiz.questions.length;
  const score = quiz ? quiz.questions.filter((x, k) => picks[k] === x.answer).length : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="quiz-title" className="card-glow max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-lg sm:rounded-b-[22px] sm:p-7" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow-lux">Quiz me</p>
            <h2 id="quiz-title" className="font-lux mt-1 line-clamp-2 text-2xl font-medium leading-tight">
              {title}
            </h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close quiz" className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink">
            <IconX size={18} />
          </button>
        </div>

        {!quiz && !error && (
          <div className="mt-8 space-y-3" aria-live="polite">
            <p className="text-sm text-muted">Writing five questions on what you covered…</p>
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-11 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {q && (
          <div className="mt-6">
            <div className="flex items-center gap-1.5" aria-hidden>
              {quiz!.questions.map((_, k) => (
                <span key={k} className={`h-1 flex-1 rounded-full ${k < i ? (picks[k] === quiz!.questions[k].answer ? "bg-emerald-500" : "bg-red-400") : k === i ? "bg-gold" : "bg-line"}`} />
              ))}
            </div>
            <p className="mt-5 text-xs text-muted">
              Question {i + 1} of {quiz!.questions.length}
            </p>
            <p className="mt-1 text-lg font-semibold leading-snug">{q.question}</p>
            <ul className="mt-4 space-y-2">
              {q.options.map((o, k) => {
                const right = picked !== null && k === q.answer;
                const wrong = picked === k && k !== q.answer;
                return (
                  <li key={k}>
                    <button
                      disabled={picked !== null}
                      onClick={() => setPicks((p) => p.map((v, j) => (j === i ? k : v)))}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${right ? "border-emerald-500 bg-emerald-500/10" : wrong ? "border-red-400 bg-red-500/10" : "border-line hover:border-gold/60 hover:bg-surface-2/60"} disabled:cursor-default`}
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-xs font-semibold">
                        {right ? <IconCheck size={14} /> : wrong ? <IconX size={14} /> : "ABCD"[k]}
                      </span>
                      {o}
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked !== null && (
              <div className="rise mt-4 rounded-xl bg-surface-2 p-3.5 text-sm" aria-live="polite">
                <p className="font-semibold">{picked === q.answer ? "Exactly right." : `Not quite — it's ${"ABCD"[q.answer]}.`}</p>
                <p className="mt-1 text-muted">{q.explanation}</p>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button className="btn" disabled={picked === null} onClick={() => setI((n) => n + 1)}>
                {i + 1 === quiz!.questions.length ? "See my score" : "Next question"}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="rise mt-8 text-center">
            <p className="num-lux text-[4rem] leading-none">
              {score}
              <span className="text-2xl text-muted">/{quiz!.questions.length}</span>
            </p>
            <p className="mt-3 text-muted">{score === quiz!.questions.length ? "Perfect. You really know this now." : score >= quiz!.questions.length - 2 ? "Strong. Look back at the ones you missed." : "A good start. Read the answer again, then try once more."}</p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setI(0);
                  setPicks(quiz!.questions.map(() => null));
                }}
              >
                Try again
              </button>
              <button className="btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
