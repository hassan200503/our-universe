"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendNudge } from "@/lib/actions/together";
import { ago } from "@/lib/ui/time";
import { Avatar } from "./avatar";
import { useCall } from "./call/call-provider";
import { IconHeadphones, IconMessage, IconPhone, IconVideo } from "./icons";
import { usePartners } from "./me-context";
import { usePulse } from "./pulse";

const PLACE: Record<string, string> = { room: "in the Together room", gallery: "looking at the gallery", chat: "in your messages", site: "on Our Universe" };

/** My partner's face with a live online/offline dot, and one-tap ways to reach them. */
export function PresencePill() {
  const partner = usePartners()[0];
  const { data } = usePulse();
  const call = useCall();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!partner) return null;
  const p = data?.partners.find((x) => x.slug === partner.slug);
  const online = p?.online ?? null;
  const first = partner.displayName.split(" ")[0];
  const status = online ? `Online · ${PLACE[p?.place ?? "site"] ?? ""}` : p?.lastSeenAt ? `Last seen ${ago(p.lastSeenAt)}` : "Offline";

  const gesture = (kind: string, label: string) =>
    start(async () => {
      await sendNudge(kind);
      setSent(label);
      setTimeout(() => setSent(null), 2500);
    });
  const ring = (kind: "audio" | "video") => {
    setOpen(false);
    call?.start(kind);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-surface-2 md:pr-2.5"
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
        <div data-world={partner.theme} className="toast rise absolute right-0 top-12 z-50 w-[19rem] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={48} online={online} />
            <div className="min-w-0">
              <p className="font-lux text-2xl font-medium leading-none">{first}</p>
              <p className={`mt-1 truncate text-xs ${online ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`} suppressHydrationWarning>
                {status}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link href="/together/chat" onClick={() => setOpen(false)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line py-2.5 text-xs font-medium transition hover:border-gold hover:bg-gold-soft">
              <IconMessage size={19} /> Message
            </Link>
            <button type="button" disabled={!call} onClick={() => ring("audio")} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line py-2.5 text-xs font-medium transition hover:border-gold hover:bg-gold-soft">
              <IconPhone size={18} /> Call
            </button>
            <button type="button" disabled={!call} onClick={() => ring("video")} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line py-2.5 text-xs font-medium transition hover:border-gold hover:bg-gold-soft">
              <IconVideo size={19} /> Video
            </button>
          </div>
          <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">Send a little something</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {[
              ["nudge", "❤️ Thinking of you"],
              ["miss", "🥺 I miss you"],
              ["hug", "🤗 Hug"],
              ["kiss", "😘 Kiss"],
            ].map(([k, l]) => (
              <button key={k} disabled={pending} onClick={() => gesture(k, l)} className="rounded-xl border border-line px-2.5 py-2 text-left transition hover:border-accent hover:bg-accent-soft">
                {l}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button disabled={pending} onClick={() => gesture("invite", "Invite sent")} className="btn flex-1 justify-center py-2 text-sm">
              <IconHeadphones size={16} /> Invite to listen
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
