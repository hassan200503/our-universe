import { NextResponse } from "next/server";
import { getCtx } from "@/lib/context";
import { iceServers } from "@/lib/calls/ice";

/** GET /api/call/ice — the ICE servers for a new call (relay credentials stay server-side until a call needs them). */
export async function GET() {
  if (!(await getCtx())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(await iceServers(), { headers: { "Cache-Control": "private, no-store" } });
}
