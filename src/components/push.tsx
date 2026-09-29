"use client";

import { useCallback, useEffect, useState } from "react";
import { IconBell, IconX } from "./icons";

type State = "unsupported" | "denied" | "off" | "on" | "working";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function subscribe(): Promise<boolean> {
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const { publicKey } = (await (await fetch("/api/push")).json()) as { publicKey: string };
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with a different key can't receive our pushes.
  if (sub && sub.options.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    const wanted = b64ToBytes(publicKey);
    if (current.length !== wanted.length || current.some((v, i) => v !== wanted[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  return res.ok;
}

/** Whether this device rings for calls and shows messages while Our Universe is closed. */
export function usePush() {
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      if (Notification.permission !== "granted") return setState("off");
      // Permission was given before: make sure the server still has this device.
      try {
        const ok = await subscribe();
        if (!cancelled) setState(ok ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!supported()) return;
    setState("working");
    try {
      const p = await Notification.requestPermission();
      if (p !== "granted") return setState(p === "denied" ? "denied" : "off");
      setState((await subscribe()) ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  const disable = useCallback(async () => {
    setState("working");
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), remove: true }) });
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }, []);

  return { state, enable, disable };
}

const DISMISS_KEY = "ou:push-prompt-dismissed";

/** A quiet banner inviting you to turn on call and message alerts for this device. */
export function PushPrompt({ partnerName }: { partnerName: string }) {
  const { state, enable } = usePush();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden || state !== "off") return null;
  return (
    <div className="flex items-center gap-3 border-b border-line bg-gold-soft/70 px-4 py-2.5 text-sm">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-gold ring-1 ring-line">
        <IconBell size={16} />
      </span>
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Never miss {partnerName}.</span> <span className="text-muted">Let calls ring and messages arrive on this device, even when Our Universe is closed.</span>
      </p>
      <button className="btn shrink-0 px-3.5 py-1.5 text-xs" onClick={enable}>
        Turn on
      </button>
      <button
        className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface"
        aria-label="Not now"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* private mode */
          }
        }}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

/** Registers the service worker once per visit, so pushes can reach this device. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/** Settings: turn call and message alerts on or off for this device. */
export function AlertsSetting() {
  const { state, enable, disable } = usePush();
  const text: Record<State, string> = {
    unsupported: "This browser can't receive alerts. On an iPhone, add Our Universe to your Home Screen (Share → Add to Home Screen) and open it from there.",
    denied: "Alerts are blocked for this site. Allow notifications in your browser's site settings, then come back here.",
    off: "Off on this device. Calls only ring while Our Universe is open.",
    on: "On. Calls ring and messages arrive on this device even when Our Universe is closed.",
    working: "Checking…",
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <p className={`min-w-0 flex-1 text-sm ${state === "on" ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>{text[state]}</p>
      {state === "off" && (
        <button type="button" className="btn" onClick={enable}>
          <IconBell size={16} /> Turn on
        </button>
      )}
      {state === "on" && (
        <button type="button" className="btn btn-ghost" onClick={disable}>
          Turn off
        </button>
      )}
    </div>
  );
}
