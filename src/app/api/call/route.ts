import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { applyCall, callAction, declineWithToken, syncCall } from "@/lib/calls/server";

const noStore = { "Cache-Control": "no-store" };

/** GET /api/call?id=<call>&after=<signal id> — polled while a call is ringing or connected. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const after = Number(req.nextUrl.searchParams.get("after") ?? 0);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Which call?" }, { status: 400 });
  const sync = await syncCall(ctx, id, Number.isFinite(after) ? after : 0);
  if (!sync) return NextResponse.json({ error: "No such call" }, { status: 404, headers: noStore });
  return NextResponse.json(sync, { headers: noStore });
}

/** POST /api/call {action: start|ringing|accept|decline|end|missed|failed|signal, …} */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  const parsed = callAction.safeParse(await req.json().catch(() => null));
  if (!ctx) {
    // "Decline" on a call notification works even on a device that's signed out.
    if (parsed.success && parsed.data.action === "decline" && parsed.data.token) {
      const result = await declineWithToken(parsed.data.id, parsed.data.token);
      return NextResponse.json(result, { status: result.ok ? 200 : 403, headers: noStore });
    }
    return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });
  }
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid call action" }, { status: 400 });
  const result = await applyCall(ctx, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 409, headers: noStore });
}
