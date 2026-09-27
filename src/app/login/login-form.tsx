"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";

type P = { slug: string; displayName: string; theme: string };

const ICON: Record<string, string> = { hassan: "💻", whitney: "🧬" };

export function LoginForm({ people, next }: { people: P[]; next: string }) {
  const [who, setWho] = useState<string | null>(people.length === 1 ? people[0].slug : null);
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(login, null);
  const person = people.find((p) => p.slug === who);
  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Choose who you are">
        {people.map((p) => (
          <button
            key={p.slug}
            type="button"
            role="radio"
            aria-checked={who === p.slug}
            data-world={p.theme}
            onClick={() => setWho(p.slug)}
            className={`card-glow lift relative overflow-hidden p-5 text-left ${who === p.slug ? "ring-2 ring-accent" : ""}`}
          >
            <span className={`absolute inset-0 opacity-60 bg-${p.theme}`} aria-hidden />
            <span className="relative block text-3xl" aria-hidden>
              {ICON[p.theme] ?? "✨"}
            </span>
            <span className="font-display relative mt-3 block text-2xl font-semibold">{p.displayName.split(" ")[0]}</span>
            <span className="relative text-xs text-muted">{who === p.slug ? "That's me ✓" : "Tap if this is you"}</span>
          </button>
        ))}
      </div>
      {person && (
        <form action={action} className="card-glow rise mt-4 p-5 text-left" data-world={person.theme}>
          <input type="hidden" name="slug" value={person.slug} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="passcode" className="text-sm font-semibold">
            Your passcode, {person.displayName.split(" ")[0]}
          </label>
          <div className="relative mt-2">
            <input id="passcode" name="passcode" type={show ? "text" : "password"} autoComplete="current-password" required autoFocus className="field pr-16" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs text-muted hover:text-ink">
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {state?.error && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <button className="btn mt-4 w-full justify-center py-3" disabled={pending}>
            {pending ? "Opening our universe…" : "Enter"}
          </button>
        </form>
      )}
    </div>
  );
}
