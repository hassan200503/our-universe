"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { clearGeminiKey, clearRelay, saveGeminiKey, saveRelay } from "@/lib/actions/secrets";
import type { ActionState } from "@/lib/actions/util";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Save and remove share one message line, so it always shows the latest
 * outcome. Forms keep what was typed when the provider says no, and clear it
 * once saved. (Each form keeps its `action` so it also works before hydration.)
 */
function useSecretForms(save: Action, clear: Action) {
  const [msg, setMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const [, saveFallback] = useActionState(save, null);
  const [, clearFallback] = useActionState(clear, null);
  const form = useRef<HTMLFormElement>(null);
  const submit = (fn: Action, reset: boolean) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await fn(null, fd);
      setMsg(r);
      if (r?.ok && reset) form.current?.reset();
    });
  };
  return { msg, pending, form, saveFallback, clearFallback, onSave: submit(save, true), onClear: submit(clear, false) };
}

type Status = { source: "env" | "saved" | "none"; hint?: string; by?: string; at?: string };

function StatusLine({ status, on, off }: { status: Status; on: string; off: string }) {
  if (status.source === "none") return <p className="text-sm text-muted">{off}</p>;
  return (
    <p className="text-sm text-emerald-700 dark:text-emerald-400">
      {on}{" "}
      <span className="text-muted">
        {status.source === "env" ? "(set in the hosting environment)" : `(${status.hint ?? "saved"}${status.by ? `, added by ${status.by}` : ""}${status.at ? ` on ${new Date(status.at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}` : ""})`}
      </span>
    </p>
  );
}

function Result({ state }: { state: ActionState }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  if (state?.ok && state.message)
    return (
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        {state.message}
      </p>
    );
  return null;
}

/** Settings → AI research. The key is checked with Google, then stored encrypted; it never comes back to the browser. */
export function AiKeySetting({ status }: { status: Status }) {
  const { msg, pending, form, saveFallback, clearFallback, onSave, onClear } = useSecretForms(saveGeminiKey, clearGeminiKey);
  return (
    <div className="mt-3 space-y-3">
      <StatusLine status={status} on="Research is on." off="Research needs a Gemini API key. It's free at aistudio.google.com → Get API key." />
      {status.source !== "env" && (
        <form ref={form} action={saveFallback} onSubmit={onSave} className="flex flex-wrap items-center gap-2">
          <label htmlFor="apiKey" className="sr-only">
            Gemini API key
          </label>
          <input id="apiKey" name="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder={status.source === "saved" ? "Paste a new key to replace it" : "Paste your Gemini API key"} className="field min-w-0 flex-1" required />
          <button className="btn" disabled={pending}>
            {pending ? "Checking…" : status.source === "saved" ? "Replace" : "Save"}
          </button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Result state={msg} />
        {status.source === "saved" && (
          <form action={clearFallback} onSubmit={onClear}>
            <button className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline" disabled={pending}>
              Remove key
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

type Provider = "metered" | "cloudflare" | "custom";

/** Opens a connection that may only use the relay, and waits for a relay candidate: proof it works from here. */
async function testRelayHere(): Promise<string> {
  const res = await fetch("/api/call/ice", { cache: "no-store" });
  const { iceServers, relay } = (await res.json()) as { iceServers: RTCIceServer[]; relay: boolean };
  if (!relay) return "No relay is set up yet.";
  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" });
  try {
    pc.createDataChannel("test");
    const found = new Promise<boolean>((resolve) => {
      pc.onicecandidate = (e) => {
        if (e.candidate?.candidate.includes(" relay ")) resolve(true);
        if (!e.candidate) resolve(false);
      };
      setTimeout(() => resolve(false), 9000);
    });
    await pc.setLocalDescription(await pc.createOffer());
    return (await found) ? "Relay works from this device ✓ Calls will connect even on strict mobile networks." : "The relay didn't answer from this network. Check the credentials, or try again on another network.";
  } finally {
    pc.close();
  }
}

/** Settings → Call relay: TURN credentials so calls connect on any network. */
export function RelaySetting({ status }: { status: Status }) {
  const [provider, setProvider] = useState<Provider>("metered");
  const { msg, pending, form, saveFallback, clearFallback, onSave, onClear } = useSecretForms(saveRelay, clearRelay);
  const [test, setTest] = useState<string | null>(null);
  const [testing, startTest] = useTransition();
  const tabs: [Provider, string][] = [
    ["metered", "Metered"],
    ["cloudflare", "Cloudflare"],
    ["custom", "Other TURN"],
  ];
  return (
    <div className="mt-3 space-y-4">
      <StatusLine status={status} on="Relay is on." off="No relay yet. Calls connect directly, which works on most networks but not all mobile ones." />
      {status.source !== "env" && (
        <form ref={form} action={saveFallback} onSubmit={onSave} className="space-y-3">
          <input type="hidden" name="provider" value={provider} />
          <div className="inline-flex rounded-full border border-line p-1" role="tablist" aria-label="Relay provider">
            {tabs.map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={provider === k}
                onClick={() => setProvider(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${provider === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {provider === "metered" && (
            <>
              <p className="text-xs text-muted">Free: sign up at metered.ca → TURN Server → create an app. Copy its domain (like yourapp.metered.live) and API key.</p>
              <input name="domain" required placeholder="yourapp.metered.live" className="field" aria-label="Metered app domain" autoComplete="off" />
              <input name="apiKey" required type="password" placeholder="Metered API key" className="field" aria-label="Metered API key" autoComplete="off" />
            </>
          )}
          {provider === "cloudflare" && (
            <>
              <p className="text-xs text-muted">Free: dash.cloudflare.com → Realtime → TURN Server → Create. Copy the Turn Token ID and API token.</p>
              <input name="keyId" required placeholder="Turn Token ID" className="field" aria-label="Cloudflare TURN token ID" autoComplete="off" />
              <input name="token" required type="password" placeholder="API token" className="field" aria-label="Cloudflare API token" autoComplete="off" />
            </>
          )}
          {provider === "custom" && (
            <>
              <p className="text-xs text-muted">Any TURN server. Separate addresses with commas, e.g. turn:relay.example.com:3478, turns:relay.example.com:443</p>
              <input name="urls" required placeholder="turn:relay.example.com:3478" className="field" aria-label="TURN addresses" autoComplete="off" />
              <input name="username" required placeholder="Username" className="field" aria-label="TURN username" autoComplete="off" />
              <input name="credential" required type="password" placeholder="Password" className="field" aria-label="TURN password" autoComplete="off" />
            </>
          )}
          <button className="btn" disabled={pending}>
            {pending ? "Checking with the provider…" : status.source === "saved" ? "Replace relay" : "Save relay"}
          </button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Result state={msg} />
        {status.source !== "none" && (
          <button type="button" className="btn btn-ghost text-sm" disabled={testing} onClick={() => startTest(async () => setTest(await testRelayHere().catch(() => "Couldn't run the test here.")))}>
            {testing ? "Testing…" : "Test from this device"}
          </button>
        )}
        {status.source === "saved" && (
          <form action={clearFallback} onSubmit={onClear}>
            <button className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline" disabled={pending}>
              Remove relay
            </button>
          </form>
        )}
      </div>
      {test && (
        <p role="status" className="text-sm">
          {test}
        </p>
      )}
    </div>
  );
}
