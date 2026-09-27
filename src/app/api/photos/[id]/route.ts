import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";

/** Serves a photo only to members of the relationship it belongs to. */
export async function GET(_: NextRequest, { params }: RouteContext<"/api/photos/[id]">) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const db = await getDb();
  const [p] = await db
    .select({ mime: photos.mime, bytes: photos.bytes })
    .from(photos)
    .where(and(eq(photos.id, id), eq(photos.relationshipId, ctx.relationship.id)));
  if (!p) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(p.bytes, "base64"), {
    headers: {
      "Content-Type": p.mime,
      // Photos never change once uploaded; private so shared caches never keep them.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
