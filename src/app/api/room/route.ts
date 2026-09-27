import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { action, applyRoom, readRoom } from "@/lib/together/room";

const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** GET /api/room?v=<version I have>&after=<last event id> — polled ~1 s while in the room. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const payload = await readRoom(ctx, num(p.get("v")), num(p.get("after")));
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/room {type: load|play|pause|seek|next|ended|queue|dequeue|chat|react, …} */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  await applyRoom(ctx, parsed.data);
  const payload = await readRoom(ctx, null, num(req.nextUrl.searchParams.get("after")));
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
