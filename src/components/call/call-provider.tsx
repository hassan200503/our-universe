"use client";

import { useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { usePulse } from "@/components/pulse";
import { CallEngine, type Snapshot } from "./engine";
import { CallScreen } from "./call-screen";
import { unlockAudio } from "./tones";

type CallApi = {
  snap: Snapshot;
  engine: CallEngine;
  start: (kind: "audio" | "video") => void;
  minimized: boolean;
  setMinimized: (v: boolean) => void;
};

const CallContext = createContext<CallApi | null>(null);

export function useCall(): CallApi | null {
  return useContext(CallContext);
}

/** Opening a call notification lands on ?call=<id>[&answer=1]: check in at once so it rings (or answers) here. */
function CallLink({ onCall }: { onCall: (id: string, answer: boolean) => void }) {
  const params = useSearchParams();
  const id = params.get("call");
  const answer = params.get("answer") === "1";
  useEffect(() => {
    if (id) onCall(id, answer);
  }, [id, answer, onCall]);
  return null;
}

/**
 * One call engine for the whole site, living in the root layout so moving
 * between pages never drops a call. Incoming calls are noticed by the pulse
 * (every few seconds while your partner is online, or instantly via push).
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const [engine] = useState(() => new CallEngine());
  const snap = useSyncExternalStore(engine.subscribe, () => engine.snapshot, () => engine.snapshot);
  const { data, refresh } = usePulse();
  // Minimised applies to one call only; the next call always opens full screen.
  const [minimizedId, setMinimizedId] = useState<string | null>(null);
  const minimized = !!minimizedId && minimizedId === snap.call?.id;
  const setMinimized = useCallback((v: boolean) => setMinimizedId(v ? (engine.snapshot.call?.id ?? null) : null), [engine]);

  const call = data?.call ?? null;
  useEffect(() => {
    if (call && call.role === "callee" && (call.status === "calling" || call.status === "ringing")) engine.incoming(call);
  }, [call, engine]);

  // "Answer" tapped on a notification: pick up as soon as the call reaches this tab.
  const onCallLink = useCallback(
    (id: string, answer: boolean) => {
      if (answer) engine.answerWhenRinging(id);
      refresh();
    },
    [engine, refresh],
  );

  useEffect(() => {
    const onSw = (e: MessageEvent) => {
      if (e.data?.type === "push" && e.data.answer) engine.answerWhenRinging(String(e.data.answer));
    };
    navigator.serviceWorker?.addEventListener("message", onSw);
    return () => navigator.serviceWorker?.removeEventListener("message", onSw);
  }, [engine]);

  useEffect(() => {
    unlockAudio();
    const bye = () => engine.beaconEnd();
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [engine]);

  const start = useCallback(
    (kind: "audio" | "video") => {
      setMinimizedId(null);
      void engine.start(kind);
    },
    [engine],
  );

  return (
    <CallContext.Provider value={{ snap, engine, start, minimized, setMinimized }}>
      {children}
      <Suspense fallback={null}>
        <CallLink onCall={onCallLink} />
      </Suspense>
      <CallScreen />
    </CallContext.Provider>
  );
}
