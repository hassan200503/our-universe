"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";

type P = { slug: string; displayName: string; theme: string };

export function LoginForm({ people, next }: { people: P[]; next: string }) {
  const [who, setWho] = useState<string | null>(people.length === 1 ? people[0].slug : null);
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
            className={`card p-5 text-left transition ${who === p.slug ? "ring-2 ring-accent" : "hover:border-accent"}`}
          >
            <span className="text-2xl" aria-hidden>
              {p.theme === "hassan" ? "💻" : p.theme === "whitney" ? "🧬" : "✨"}
            </span>
            <span className="font-display mt-2 block text-xl font-semibold">{p.displayName.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      {person && (
        <form action={action} className="card mt-4 p-5 text-left" data-world={person.theme}>
          <input type="hidden" name="slug" value={person.slug} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="passcode" className="text-sm font-semibold">
            Your passcode, {person.displayName.split(" ")[0]}
          </label>
          <input id="passcode" name="passcode" type="password" autoComplete="current-password" required autoFocus className="field mt-2" />
          {state?.error && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <button className="btn mt-4 w-full justify-center" disabled={pending}>
            {pending ? "Opening…" : "Enter"}
          </button>
        </form>
      )}
    </div>
  );
}
