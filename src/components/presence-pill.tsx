"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendNudge } from "@/lib/actions/together";
import { ago } from "@/lib/ui/time";
import { Avatar } from "./avatar";
import { usePartners } from "./me-context";
import { usePulse } from "./pulse";

const PLACE: Record<string, string> = { room: "in the Together room 🎧", gallery: "looking at the gallery 📸", site: "on Our Universe" };

/** My partner's face with a live online/offline dot, and one-tap gestures. */
export function PresencePill() {
  const partner = usePartners()[0];
  const { data } = usePulse();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!partner) return null;
  const p = data?.partners.find((x) => x.slug === partner.slug);
  const online = p?.online ?? null;
  const first = partner.displayName.split(" ")[0];
  const status = online ? `Online now · ${PLACE[p?.place ?? "site"] ?? ""}` : p?.lastSeenAt ? `Last seen ${ago(p.lastSeenAt)}` : "Offline";

  const gesture = (kind: string, label: string) =>
    start(async () => {
      await sendNudge(kind);
      setSent(label);
      setTimeout(() => setSent(null), 2500);
    });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-surface-2"
        aria-expanded={open}
        aria-label={`${first}: ${status}`}
      >
        <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={30} online={online} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-xs font-semibold">{first}</span>
          <span className={`block text-[0.65rem] ${online ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`} suppressHydrationWarning>
            {online ? "Online" : p?.lastSeenAt ? ago(p.lastSeenAt) : "Offline"}
          </span>
        </span>
      </button>
      {open && (
        <div data-world={partner.theme} className="card rise absolute right-0 top-11 z-50 w-72 p-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={48} online={online} />
            <div>
              <p className="font-display text-lg font-semibold">{first}</p>
              <p className={`text-xs ${online ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`} suppressHydrationWarning>
                {status}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {online ? `${first} is here right now — a perfect moment to listen or watch together.` : `${first} will see these the next time they open Our Universe.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {[
              ["nudge", "❤️ Thinking of you"],
              ["miss", "🥺 I miss you"],
              ["hug", "🤗 Hug"],
              ["kiss", "😘 Kiss"],
            ].map(([k, l]) => (
              <button key={k} disabled={pending} onClick={() => gesture(k, l)} className="rounded-xl border border-line px-2 py-2 text-left transition hover:border-accent hover:bg-accent-soft">
                {l}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button disabled={pending} onClick={() => gesture("invite", "🎧 Invite sent")} className="btn flex-1 justify-center py-2 text-sm">
              🎧 Invite to listen
            </button>
            {p?.place === "room" && online && (
              <Link href="/together" className="btn btn-ghost py-2 text-sm" onClick={() => setOpen(false)}>
                Join
              </Link>
            )}
          </div>
          {sent && (
            <p role="status" className="mt-2 text-center text-xs text-accent">
              Sent: {sent}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
