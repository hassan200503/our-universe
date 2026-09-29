import { NextResponse } from "next/server";
import { getCtx } from "@/lib/context";

type Ice = { urls: string | string[]; username?: string; credential?: string };

const STUN: Ice[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, { urls: "stun:stun.cloudflare.com:3478" }];

const g = globalThis as unknown as { __ice?: { at: number; servers: Ice[] } };

// Browsers can't use port 53, and some providers list it: drop those URLs so gathering doesn't stall on them.
const usable = (list: Ice[]) =>
  list
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);

/**
 * TURN relays let a call connect when both phones sit behind strict NATs
 * (common on mobile data). Configure any one of:
 *   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN   (Cloudflare Realtime, free tier)
 *   METERED_TURN_DOMAIN + METERED_TURN_API_KEY           (Metered / Open Relay, free tier)
 *   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL          (any TURN server; URLs comma-separated)
 * Without one, calls still connect directly on most networks using STUN.
 */
async function relays(): Promise<Ice[]> {
  const env = process.env;
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return ((await res.json()) as { iceServers: Ice[] }).iceServers;
  }
  if (env.METERED_TURN_DOMAIN && env.METERED_TURN_API_KEY) {
    const res = await fetch(`https://${env.METERED_TURN_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_TURN_API_KEY)}`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) return (await res.json()) as Ice[];
  }
  if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    return [{ urls: env.TURN_URLS.split(",").map((u) => u.trim()).filter(Boolean), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }];
  }
  return [];
}

/** GET /api/call/ice — the ICE servers for a new call. Relay credentials are cached for an hour. */
export async function GET() {
  if (!(await getCtx())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!g.__ice || Date.now() - g.__ice.at > 3600_000) {
    const turn = await relays().catch(() => []);
    g.__ice = { at: turn.length ? Date.now() : Date.now() - 3300_000, servers: usable([...STUN, ...turn.filter((s) => JSON.stringify(s.urls).includes("turn"))]) };
  }
  const servers = g.__ice.servers;
  return NextResponse.json({ iceServers: servers, relay: servers.some((s) => JSON.stringify(s.urls).includes("turn")) }, { headers: { "Cache-Control": "private, no-store" } });
}
