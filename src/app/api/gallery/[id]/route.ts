import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { mediaByIds, mediaComments_ } from "@/lib/media/queries";

/** One item with its comments (for the viewer). */
export async function GET(_: NextRequest, { params }: RouteContext<"/api/gallery/[id]">) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [item] = await mediaByIds(ctx, [id]);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const comments = await mediaComments_(ctx, id);
  return NextResponse.json({ item, comments: comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), mine: c.personId === ctx.me.id })) }, { headers: { "Cache-Control": "private, no-store" } });
}
