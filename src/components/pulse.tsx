"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PulseResponse } from "@/app/api/pulse/route";
import { Avatar } from "./avatar";
import { IconX } from "./icons";
import { useMembers } from "./me-context";
import { roomLive } from "@/lib/ui/room-live";
import { buzz } from "@/lib/ui/buzz";

type PulseState = { data: PulseResponse | null; refresh: () => void };
const PulseContext = createContext<PulseState>({ data: null, refresh: () => {} });
export const usePulse = () => useContext(PulseContext);

/**
 * How often to check in: fast while a call can come in, slow when my partner
 * isn't around. An open chat polls on its own (and rings for calls), so the
 * pulse can relax there.
 */
function cadence(data: PulseResponse | null, place: string) {
  if (data?.call) return 2_000;
  if (place === "chat") return 10_000;
  if (data?.partners.some((p) => p.online)) return 3_000;
  return 15_000;
}

function placeFor(path: string) {
  if (path.startsWith("/together/chat")) return "chat";
  if (path.startsWith("/together")) return "room";
  if (path.startsWith("/gallery")) return "gallery";
  return "site";
}

type Toast = { id: string; slug: string; kind: string; body: string };

function Hearts() {
  // A small burst of floating hearts; skipped for people who prefer less motion.
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden motion-reduce:hidden" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="absolute bottom-0 text-2xl"
          style={{ left: `${5 + ((i * 37) % 90)}%`, animation: `float-up ${2.2 + (i % 5) * 0.35}s ease-out ${(i % 7) * 0.12}s forwards`, opacity: 0 }}
        >
          {i % 3 === 0 ? "💖" : "❤️"}
        </span>
      ))}
    </div>
  );
}

/** Unread messages on the app icon (installed apps), like a phone's messenger. */
function appBadge(n: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
}

/** A soft two-note chime for a new message, made on the fly (no sound files to download). */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    if (ac.state === "suspended") return void ac.close();
    [880, 1318.5].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ac.currentTime + i * 0.11;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
    setTimeout(() => ac.close(), 800);
  } catch {
    /* no audio on this device */
  }
}

/**
 * Keeps presence fresh for everyone in the relationship: a heartbeat every few
 * seconds while the tab is visible (every 3 s while my partner is online, so a
 * call rings quickly), an immediate one on return or when a push arrives, and a
 * "left" beacon when the tab is hidden or closed, so "online" is accurate
 * within seconds. Nudges, invites and new messages arrive as toasts.
 */
export function PulseProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const members = useMembers();
  const [data, setData] = useState<PulseResponse | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burst, setBurst] = useState(0);
  const after = useRef<number | null>(null);
  const lastMessage = useRef<number | null>(null);
  const place = useRef("site");
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: PulseResponse | null = null;

    const run = async (): Promise<void> => {
      if (busy) {
        again = true;
        return;
      }
      clearTimeout(timer);
      busy = true;
      try {
        if (document.visibilityState === "visible") {
          const res = await fetch("/api/pulse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ place: place.current, after: after.current }),
            cache: "no-store",
          });
          if (res.ok) {
            const json = (await res.json()) as PulseResponse;
            last = json;
            const fresh: Toast[] = [];
            // "Started playing …" is news only if you aren't already listening together on this device.
            const events = json.events.filter((e) => !(e.kind === "system" && roomLive.current));
            if (after.current !== null && events.length) {
              fresh.push(...events.map((e) => ({ id: `e${e.id}`, slug: e.slug, kind: e.kind, body: e.body })));
              if (events.some((e) => e.kind === "nudge")) setBurst((b) => b + 1);
              buzz(80);
            }
            const latest = json.chat?.latest;
            if (latest && lastMessage.current !== null && latest.id > lastMessage.current && place.current !== "chat") {
              fresh.push({ id: `m${latest.id}`, slug: latest.slug, kind: "message", body: latest.body });
              chime();
            }
            lastMessage.current = Math.max(lastMessage.current ?? 0, latest?.id ?? 0);
            if (fresh.length) setToasts((t) => [...t.filter((x) => !fresh.some((f) => f.id === x.id)), ...fresh].slice(-3));
            after.current = json.lastEventId;
            setData(json);
            appBadge(json.chat?.unread ?? 0);
          }
        }
      } catch {
        /* offline for a moment; the next beat will catch up */
      } finally {
        busy = false;
      }
      if (stopped) return;
      if (again) {
        again = false;
        return run();
      }
      timer = setTimeout(run, cadence(last, place.current));
    };
    kick.current = () => void run();
    run();

    const leave = () => navigator.sendBeacon?.("/api/pulse", new Blob([JSON.stringify({ leave: true })], { type: "application/json" }));
    const onVis = () => (document.visibilityState === "visible" ? run() : leave());
    const onKick = () => run();
    // The service worker forwards pushes (an incoming call, a message) so this tab reacts at once.
    const onSw = (e: MessageEvent) => {
      if (e.data?.type === "push") run();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", leave);
    window.addEventListener("ou:pulse", onKick);
    navigator.serviceWorker?.addEventListener("message", onSw);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("ou:pulse", onKick);
      navigator.serviceWorker?.removeEventListener("message", onSw);
    };
  }, []);

  const refresh = useCallback(() => kick.current(), []);

  // Tell the other person where I am as soon as I move between pages.
  useEffect(() => {
    place.current = placeFor(path);
    if (place.current === "chat") setToasts((t) => t.filter((x) => x.kind !== "message"));
    kick.current();
  }, [path]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 7000);
    return () => clearTimeout(t);
  }, [toasts]);

  const person = (slug: string) => members.find((m) => m.slug === slug);
  const dismiss = (id: string) => setToasts((x) => x.filter((y) => y.id !== id));

  return (
    <PulseContext.Provider value={{ data, refresh }}>
      {children}
      {burst > 0 && <Hearts key={burst} />}
      <div className="pointer-events-none fixed inset-x-3 top-[4.5rem] z-[70] flex flex-col items-center gap-2 sm:left-auto sm:right-5 sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const p = person(t.slug);
          const first = p?.displayName.split(" ")[0] ?? "Someone";
          const action = t.kind === "invite" ? { href: "/together", label: "Join" } : t.kind === "message" ? { href: "/together/chat", label: "Reply" } : null;
          return (
            <div key={t.id} data-world={p?.theme ?? "us"} className="toast rise pointer-events-auto flex w-full max-w-sm items-center gap-3 py-2.5 pl-2.5 pr-3">
              {p ? <Avatar name={p.displayName} url={p.avatarUrl} theme={p.theme} size={38} /> : <span className="size-9" />}
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <strong className="font-semibold">{first}</strong>
                {t.kind === "message" ? <span className="line-clamp-2 text-muted">{t.body}</span> : <span className="text-muted"> {t.body}</span>}
              </p>
              {action && (
                <Link href={action.href} className="btn shrink-0 px-3.5 py-1.5 text-xs" onClick={() => dismiss(t.id)}>
                  {action.label}
                </Link>
              )}
              <button className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <IconX size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </PulseContext.Provider>
  );
}
