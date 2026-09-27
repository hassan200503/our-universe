import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { galleryPage } from "@/lib/media/queries";

/** GET /api/gallery?kind=photo|video|song&by=whitney&cursor=… */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const page = await galleryPage(ctx, { kind: p.get("kind"), by: p.get("by"), cursor: p.get("cursor") });
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
