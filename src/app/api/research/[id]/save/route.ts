import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { saveToLearning } from "@/lib/research/server";

/** POST /api/research/:id/save {messageId} — keep an answer in "Things we are learning". */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/research/[id]/save">) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = z.object({ messageId: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  return (await saveToLearning(ctx, id, body.data.messageId)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Couldn't save that" }, { status: 404 });
}
