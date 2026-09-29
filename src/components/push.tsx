"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconBell, IconPlus, IconX } from "./icons";

/**
 * Alerts on this device: calls ring and messages arrive even when Our
 * Universe is closed or nobody is signed in here, like a phone's messenger.
 *
 *   unsupported — the browser can't do Web Push at all
 *   install     — an iPhone/iPad in Safari: push works once the site is on the Home Screen
 *   denied      — blocked in the browser's site settings
 *   off / on    — not yet turned on / turned on for this device
 */
type State = "unsupported" | "install" | "denied" | "off" | "on" | "working";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const standalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

function currentState(): State {
  if (!supported()) return isIos() && !standalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" ? "on" : "off";
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Subscribes this device (or refreshes its subscription) and tells the server. */
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

export function usePush() {
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    let cancelled = false;
    // Checked after mount: the server can't know this device's permission.
    const settle = (v: State) => !cancelled && setState(v);
    const s = currentState();
    if (s !== "on") queueMicrotask(() => settle(s));
    else
      subscribe()
        .then((ok) => settle(ok ? "on" : "off"))
        .catch(() => settle("off"));
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
const SHEET_KEY = "ou:reach-sheet-dismissed-at";

function readFlag(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeFlag(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/** The share glyph iOS uses, drawn inline so the instructions match what's on screen. */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline -translate-y-px" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

/** A quiet banner in Messages inviting you to turn alerts on for this device. */
export function PushPrompt({ partnerName }: { partnerName: string }) {
  const { state, enable } = usePush();
  const [hidden, setHidden] = useState(() => typeof window === "undefined" || readFlag(DISMISS_KEY) === "1");
  if (hidden || (state !== "off" && state !== "install")) return null;
  return (
    <div className="flex items-center gap-3 border-b border-line bg-gold-soft/70 px-4 py-2.5 text-sm">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-gold ring-1 ring-line">
        <IconBell size={16} />
      </span>
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Never miss {partnerName}.</span>{" "}
        {state === "install" ? (
          <span className="text-muted">
            Tap <ShareGlyph /> then “Add to Home Screen”, and open Our Universe from there to get calls and messages even when it&apos;s closed.
          </span>
        ) : (
          <span className="text-muted">Let calls ring and messages pop up on this device, even when Our Universe is closed.</span>
        )}
      </p>
      {state === "off" && (
        <button className="btn shrink-0 px-3.5 py-1.5 text-xs" onClick={enable}>
          Turn on
        </button>
      )}
      <button
        className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface"
        aria-label="Not now"
        onClick={() => {
          setHidden(true);
          writeFlag(DISMISS_KEY, "1");
        }}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

/**
 * Shortly after signing in on a new device, invite the person to stay
 * reachable (browsers only show the permission prompt after a tap). Asks
 * again a week after "Not now"; never nags once alerts are on or blocked.
 */
export function ReachPrompt({ partnerName }: { partnerName: string }) {
  const path = usePathname();
  const { state, enable } = usePush();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (state !== "off" && state !== "install") return;
    if (Date.now() - Number(readFlag(SHEET_KEY) ?? 0) < 7 * 86400_000) return;
    const t = setTimeout(() => setOpen(true), 2200);
    return () => clearTimeout(t);
  }, [state]);

  if (!open || path.startsWith("/together/chat")) return null;
  const close = () => {
    setOpen(false);
    writeFlag(SHEET_KEY, String(Date.now()));
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:items-center" role="presentation" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reach-title"
        onClick={(e) => e.stopPropagation()}
        className="stage rise relative w-full max-w-md overflow-hidden rounded-[28px] p-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-[#f4ede2] shadow-2xl"
      >
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <button type="button" onClick={close} className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Not now">
          <IconX size={16} />
        </button>
        <div className="relative z-[3]">
          <span className="grid size-12 place-items-center rounded-full bg-white/10 text-[#f0dcae] ring-1 ring-white/15">
            <IconBell size={22} />
          </span>
          {done ? (
            <>
              <h2 id="reach-title" className="font-lux mt-5 text-[2rem] leading-tight">
                You&apos;re within reach.
              </h2>
              <p className="mt-2 text-white/70">{partnerName}&apos;s calls will ring here, and messages will pop up, even when Our Universe is closed.</p>
              <button type="button" className="btn-gold mt-6 w-full justify-center" onClick={close}>
                Lovely
              </button>
            </>
          ) : state === "install" ? (
            <>
              <h2 id="reach-title" className="font-lux mt-5 text-[2rem] leading-tight">
                Keep {partnerName} one tap away
              </h2>
              <p className="mt-2 text-white/70">On iPhone, calls and messages reach you when the site is closed once Our Universe is on your Home Screen:</p>
              <ol className="mt-5 space-y-3 text-sm text-white/85">
                <li className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs">1</span>
                  <span>
                    Tap <ShareGlyph /> Share in Safari&apos;s toolbar
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs">2</span>
                  <span className="flex items-center gap-1.5">
                    Choose <IconPlus size={15} /> Add to Home Screen
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs">3</span>
                  <span>Open it from your Home Screen, sign in, and turn alerts on</span>
                </li>
              </ol>
              <button type="button" className="btn-gold mt-6 w-full justify-center" onClick={close}>
                Got it
              </button>
            </>
          ) : (
            <>
              <h2 id="reach-title" className="font-lux mt-5 text-[2rem] leading-tight">
                Stay within reach
              </h2>
              <p className="mt-2 text-white/70">Let {partnerName}&apos;s calls ring and messages pop up on this device, even when Our Universe is closed or you&apos;re signed out, just like a phone.</p>
              <button
                type="button"
                className="btn-gold mt-6 w-full justify-center"
                onClick={async () => {
                  await enable();
                  if (Notification.permission === "granted") setDone(true);
                  else close();
                }}
              >
                <IconBell size={17} /> Turn on notifications
              </button>
              <button type="button" className="mt-3 w-full py-2 text-sm text-white/60 hover:text-white" onClick={close}>
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Settings: turn call and message alerts on or off for this device. */
export function AlertsSetting() {
  const { state, enable, disable } = usePush();
  const text: Record<State, string> = {
    unsupported: "This browser can't receive alerts. Chrome, Edge, Firefox and Safari can.",
    install: "On iPhone and iPad, add Our Universe to your Home Screen first (Share → Add to Home Screen), open it from there, then turn alerts on here.",
    denied: "Alerts are blocked for this site. Allow notifications in your browser's site settings, then come back here.",
    off: "Off on this device. Calls only ring while Our Universe is open.",
    on: "On. Calls ring and messages pop up on this device even when Our Universe is closed or you're signed out.",
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

/**
 * Registers the service worker on every signed-in visit and, where alerts are
 * already allowed, refreshes this device's subscription on the server, so
 * alerts keep arriving after browser updates, key changes or signing out.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => (supported() && Notification.permission === "granted" ? subscribe() : false))
      .catch(() => {});
  }, []);
  return null;
}
