import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { withSchema } from "@/lib/db/client";
import { removeSubscription, saveSubscription, vapidKeys } from "@/lib/push/server";

/** GET /api/push — the public key a browser needs to subscribe. */
export async function GET() {
  if (!(await getCtx())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json({ publicKey: vapidKeys().publicKey });
}

// Only the browsers' own push services: the server never posts to an arbitrary address.
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.microsoft\.com$/];
const pushEndpoint = z
  .url()
  .max(1000)
  .refine((u) => {
    const url = new URL(u);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(url.hostname));
  }, "Not a push service");

const body = z.object({
  subscription: z.object({ endpoint: pushEndpoint, keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  remove: z.boolean().optional(),
});

/** POST /api/push {subscription, remove?} — turn call and message alerts on or off for this device. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  const { subscription, remove } = parsed.data;
  await withSchema(() => (remove ? removeSubscription(ctx, subscription.endpoint) : saveSubscription(ctx, subscription, req.headers.get("user-agent"))));
  return NextResponse.json({ ok: true });
}
