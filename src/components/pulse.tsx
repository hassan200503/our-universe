"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PulseResponse } from "@/app/api/pulse/route";
import { useMembers } from "./me-context";

type PulseState = { data: PulseResponse | null; refresh: () => void };
const PulseContext = createContext<PulseState>({ data: null, refresh: () => {} });
export const usePulse = () => useContext(PulseContext);

const INTERVAL_MS = 25_000;

function placeFor(path: string) {
  if (path.startsWith("/together")) return "room";
  if (path.startsWith("/gallery")) return "gallery";
  return "site";
}

type Toast = { id: number; slug: string; kind: string; body: string };

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

/**
 * Keeps presence fresh for everyone in the relationship: a heartbeat every
 * 25 s while the tab is visible, an immediate one on return, and a "left"
 * beacon when the tab is hidden or closed, so "online" is accurate within
 * seconds. Nudges and invites arrive as toasts.
 */
export function PulseProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const members = useMembers();
  const [data, setData] = useState<PulseResponse | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burst, setBurst] = useState(0);
  const after = useRef<number | null>(null);
  const place = useRef("site");

  const beat = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place: place.current, after: after.current }),
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as PulseResponse;
      if (after.current !== null && json.events.length) {
        setToasts((t) => [...t, ...json.events.map((e) => ({ id: e.id, slug: e.slug, kind: e.kind, body: e.body }))].slice(-3));
        if (json.events.some((e) => e.kind === "nudge")) setBurst((b) => b + 1);
        if ("vibrate" in navigator) navigator.vibrate?.(80);
      }
      after.current = json.lastEventId;
      setData(json);
    } catch {
      /* offline for a moment; the next beat will catch up */
    }
  }, []);

  useEffect(() => {
    beat();
    const id = setInterval(beat, INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
      else navigator.sendBeacon?.("/api/pulse", new Blob([JSON.stringify({ leave: true })], { type: "application/json" }));
    };
    const onHide = () => navigator.sendBeacon?.("/api/pulse", new Blob([JSON.stringify({ leave: true })], { type: "application/json" }));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [beat]);

  // Tell the other person where I am as soon as I move between pages.
  useEffect(() => {
    place.current = placeFor(path);
    beat();
  }, [path, beat]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 7000);
    return () => clearTimeout(t);
  }, [toasts]);

  const nameOf = (slug: string) => members.find((m) => m.slug === slug)?.displayName.split(" ")[0] ?? "Someone";
  const themeOf = (slug: string) => members.find((m) => m.slug === slug)?.theme ?? "us";

  return (
    <PulseContext.Provider value={{ data, refresh: beat }}>
      {children}
      {burst > 0 && <Hearts key={burst} />}
      <div className="fixed inset-x-3 top-16 z-[70] flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} data-world={themeOf(t.slug)} className="card-glow rise flex max-w-sm items-center gap-3 px-4 py-3 shadow-2xl">
            <span className="text-2xl" aria-hidden>
              {t.kind === "invite" ? "🎧" : t.kind === "system" ? "✨" : "💌"}
            </span>
            <p className="text-sm">
              <strong>{nameOf(t.slug)}</strong> {t.body}
            </p>
            {t.kind === "invite" && (
              <Link href="/together" className="btn shrink-0 px-3 py-1.5 text-xs" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
                Join
              </Link>
            )}
            <button className="text-muted" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </PulseContext.Provider>
  );
}
