import "server-only";
import { createHash } from "node:crypto";
import { readSecret, SECRET_RELAY, type RelayConfig } from "@/lib/settings";

export type Ice = { urls: string | string[]; username?: string; credential?: string };

const STUN: Ice[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, { urls: "stun:stun.cloudflare.com:3478" }];

// Browsers can't use port 53, and some providers list it: drop those URLs so gathering doesn't stall on them.
const usable = (list: Ice[]) =>
  list
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);

const isTurn = (s: Ice) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/.test(u));

/**
 * A relay configured in the environment wins; otherwise the one saved in
 * Settings → Call relay. Environment variables:
 *   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *   METERED_TURN_DOMAIN + METERED_TURN_API_KEY
 *   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
 */
function fromEnv(): RelayConfig | null {
  const e = process.env;
  if (e.CLOUDFLARE_TURN_KEY_ID && e.CLOUDFLARE_TURN_API_TOKEN) return { provider: "cloudflare", keyId: e.CLOUDFLARE_TURN_KEY_ID, token: e.CLOUDFLARE_TURN_API_TOKEN };
  if (e.METERED_TURN_DOMAIN && e.METERED_TURN_API_KEY) return { provider: "metered", domain: e.METERED_TURN_DOMAIN, apiKey: e.METERED_TURN_API_KEY };
  if (e.TURN_URLS && e.TURN_USERNAME && e.TURN_CREDENTIAL)
    return { provider: "custom", urls: e.TURN_URLS.split(",").map((u) => u.trim()).filter(Boolean), username: e.TURN_USERNAME, credential: e.TURN_CREDENTIAL };
  return null;
}

/** Asks the provider for (short-lived) relay credentials. Throws a readable error when it refuses. */
export async function fetchRelay(c: RelayConfig): Promise<Ice[]> {
  if (c.provider === "cloudflare") {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(c.keyId)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Cloudflare refused the key ID or API token." : `Cloudflare answered ${res.status}.`);
    return ((await res.json()) as { iceServers: Ice[] }).iceServers.filter(isTurn);
  }
  if (c.provider === "metered") {
    const domain = c.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(c.apiKey)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Metered refused the API key." : `Metered answered ${res.status}. Check the app domain.`);
    return ((await res.json()) as Ice[]).filter(isTurn);
  }
  return [{ urls: c.urls, username: c.username, credential: c.credential }];
}

const g = globalThis as unknown as { __ice?: { key: string; at: number; servers: Ice[] } };

/** ICE servers for a new call: STUN always, plus a relay when one is configured. Cached for an hour per configuration. */
export async function iceServers(): Promise<{ iceServers: Ice[]; relay: boolean }> {
  const config = fromEnv() ?? (await readSecret<RelayConfig>(SECRET_RELAY));
  const key = createHash("sha256").update(JSON.stringify(config ?? null)).digest("hex");
  const cached = g.__ice;
  if (!cached || cached.key !== key || Date.now() - cached.at > 3600_000) {
    let turn: Ice[] = [];
    let ok = true;
    if (config) {
      try {
        turn = await fetchRelay(config);
      } catch {
        ok = false;
      }
    }
    // A provider hiccup is retried after five minutes rather than an hour.
    g.__ice = { key, at: ok ? Date.now() : Date.now() - 3300_000, servers: usable([...STUN, ...turn]) };
  }
  const servers = g.__ice!.servers;
  return { iceServers: servers, relay: servers.some(isTurn) };
}

export function relaySource(): "env" | null {
  return fromEnv() ? "env" : null;
}
