"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";
import { IconArrowRight } from "@/components/icons";

type P = { slug: string; displayName: string; theme: string };

const DOT: Record<string, string> = { hassan: "from-[#c9c6ff] to-[#5b55d6]", whitney: "from-[#cfeede] to-[#4f8f6c]" };

export function LoginForm({ people, next }: { people: P[]; next: string }) {
  const [who, setWho] = useState<string | null>(people.length === 1 ? people[0].slug : null);
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(login, null);
  const person = people.find((p) => p.slug === who);
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-[#f4ede2] shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8">
      <p className="text-[0.66rem] uppercase tracking-[0.32em] text-white/55">Step inside</p>
      <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Choose who you are">
        {people.map((p) => {
          const on = who === p.slug;
          return (
            <button
              key={p.slug}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setWho(p.slug)}
              className={`group relative rounded-2xl border p-4 text-left transition duration-300 ${on ? "border-[#e2c794]/70 bg-white/[0.09]" : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"}`}
            >
              <span className={`block size-9 rounded-full bg-gradient-to-br shadow-[0_0_24px_-4px_rgb(255_255_255/0.35)] ${DOT[p.theme] ?? "from-[#f6e3b8] to-[#b8894a]"}`} aria-hidden />
              <span className="font-lux mt-4 block text-[1.7rem] leading-none">{p.displayName.split(" ")[0]}</span>
              <span className={`mt-2 block text-[0.7rem] tracking-wide ${on ? "text-[#e2c794]" : "text-white/45"}`}>{on ? "That's me" : "This is me"}</span>
            </button>
          );
        })}
      </div>
      {person ? (
        <form action={action} className="rise mt-5">
          <input type="hidden" name="slug" value={person.slug} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="passcode" className="text-sm text-white/70">
            Your passcode, {person.displayName.split(" ")[0]}
          </label>
          <div className="relative mt-2">
            <input
              id="passcode"
              name="passcode"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              autoFocus
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 pr-16 text-[0.95rem] text-white outline-none transition placeholder:text-white/30 focus:border-[#e2c794]/70 focus:shadow-[0_0_0_4px_rgb(226_199_148/0.15)]"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs text-white/55 hover:text-white">
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {state?.error && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {state.error}
            </p>
          )}
          <button className="btn-gold mt-5 w-full justify-center" disabled={pending}>
            {pending ? "Opening our universe…" : "Enter"}
            {!pending && <IconArrowRight size={17} />}
          </button>
        </form>
      ) : (
        <p className="mt-5 text-sm text-white/45">Choose your name to continue.</p>
      )}
    </div>
  );
}
