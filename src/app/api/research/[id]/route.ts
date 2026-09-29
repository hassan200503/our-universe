import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { deleteThread, getThread, updateThread } from "@/lib/research/server";

const idOk = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** GET /api/research/:id — one thread with its messages (mine, or shared with me). */
export async function GET(_: NextRequest, { params }: RouteContext<"/api/research/[id]">) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await params;
  const thread = idOk(id) ? await getThread(ctx, id) : null;
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(thread, { headers: { "Cache-Control": "no-store" } });
}

const patch = z.object({ shared: z.boolean().optional(), title: z.string().trim().min(1).max(120).optional() });

/** PATCH /api/research/:id {shared?, title?} — the owner shares it with their partner, or renames it. */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/research/[id]">) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await params;
  const body = patch.safeParse(await req.json().catch(() => null));
  if (!idOk(id) || !body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  return (await updateThread(ctx, id, body.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Only the person who started it can change it" }, { status: 403 });
}

/** DELETE /api/research/:id — the owner removes it. */
export async function DELETE(_: NextRequest, { params }: RouteContext<"/api/research/[id]">) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await params;
  return idOk(id) && (await deleteThread(ctx, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Only the person who started it can delete it" }, { status: 403 });
}
