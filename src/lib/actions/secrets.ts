"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCtx } from "@/lib/context";
import { fetchRelay } from "@/lib/calls/ice";
import { testKey } from "@/lib/research/gemini";
import { SECRET_GEMINI, SECRET_RELAY, writeSecret, type RelayConfig } from "@/lib/settings";
import { firstError, formObject, type ActionState } from "./util";

const last4 = (s: string) => `•••• ${s.slice(-4)}`;

/** Settings → AI research: store the Gemini key (checked with Google first). */
export async function saveGeminiKey(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCtx();
  const key = String(fd.get("apiKey") ?? "").trim();
  if (!/^[\w.-]{20,200}$/.test(key)) return { error: "That doesn't look like a Gemini API key." };
  const check = await testKey(key);
  if (!check.ok) return { error: check.message };
  await writeSecret(SECRET_GEMINI, key, { hint: last4(key), by: ctx.me.displayName.split(" ")[0] });
  revalidatePath("/settings");
  revalidatePath("/research");
  return { ok: true, message: `Research is on. ${check.message}` };
}

export async function clearGeminiKey(): Promise<ActionState> {
  await requireCtx();
  await writeSecret(SECRET_GEMINI, null);
  revalidatePath("/settings");
  revalidatePath("/research");
  return { ok: true, message: "Removed." };
}

const relay = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("metered"), domain: z.string().min(4).max(200), apiKey: z.string().min(8).max(300) }),
  z.object({ provider: z.literal("cloudflare"), keyId: z.string().min(8).max(200), token: z.string().min(8).max(500) }),
  z.object({ provider: z.literal("custom"), urls: z.string().min(6).max(1000), username: z.string().min(1).max(300), credential: z.string().min(1).max(500) }),
]);

/** Settings → Call relay: store TURN credentials after proving the provider accepts them. */
export async function saveRelay(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCtx();
  const parsed = relay.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  let config: RelayConfig;
  if (d.provider === "custom") {
    const urls = d.urls
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (!urls.length || urls.some((u) => !/^turns?:/.test(u))) return { error: "Relay addresses start with turn: or turns:" };
    config = { provider: "custom", urls, username: d.username, credential: d.credential };
  } else if (d.provider === "metered") {
    // Only a public host name: the server fetches from it.
    const domain = d.domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || /^[\d.]+$/.test(domain) || /(^|\.)(localhost|local|internal)$/.test(domain))
      return { error: "Use the app domain from Metered, like yourapp.metered.live" };
    config = { provider: "metered", domain, apiKey: d.apiKey };
  } else config = d;
  try {
    const servers = await fetchRelay(config);
    if (!servers.length) return { error: "The provider answered, but without any relay servers." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The provider couldn't be reached." };
  }
  const hint = config.provider === "metered" ? `Metered · ${config.domain}` : config.provider === "cloudflare" ? `Cloudflare · ${last4(config.keyId)}` : `TURN · ${config.urls[0]}`;
  await writeSecret(SECRET_RELAY, config, { hint, by: ctx.me.displayName.split(" ")[0] });
  revalidatePath("/settings");
  return { ok: true, message: "Relay saved and accepted by the provider. Calls will use it from the next call." };
}

export async function clearRelay(): Promise<ActionState> {
  await requireCtx();
  await writeSecret(SECRET_RELAY, null);
  revalidatePath("/settings");
  return { ok: true, message: "Removed." };
}
