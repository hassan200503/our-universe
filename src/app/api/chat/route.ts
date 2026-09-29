import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { applyChat, chatAction, syncChat } from "@/lib/chat/server";
import { currentCall } from "@/lib/calls/server";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/chat              → the latest page of messages
 * GET /api/chat?before=<id>  → the page before that message
 * GET /api/chat?since=<iso>  → everything that changed since the last sync (polled)
 */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const before = Number(p.get("before"));
  const [sync, call] = await Promise.all([syncChat(ctx, { since: p.get("since"), before: Number.isInteger(before) && before > 0 ? before : null }), currentCall(ctx).catch(() => null)]);
  return NextResponse.json({ ...sync, call }, { headers: noStore });
}

/** POST /api/chat {type: send|edit|delete|react|typing|read, …} */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = chatAction.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400 });
  const result = await applyChat(ctx, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 422, headers: noStore });
}
