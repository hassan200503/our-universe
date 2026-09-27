import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

/** Upload one photo (already compressed in the browser). Returns its private URL. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo attached" }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Photos must be WebP, JPEG or PNG" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 2 MB after compression)" }, { status: 413 });
  const num = (k: string) => {
    const n = Number(form?.get(k));
    return Number.isFinite(n) && n > 0 && n < 20000 ? Math.round(n) : null;
  };
  const caption = String(form?.get("caption") ?? "").trim().slice(0, 300) || null;
  const db = await getDb();
  const [row] = await db
    .insert(photos)
    .values({
      relationshipId: ctx.relationship.id,
      uploadedBy: ctx.me.id,
      mime: file.type,
      bytes: Buffer.from(await file.arrayBuffer()).toString("base64"),
      width: num("width"),
      height: num("height"),
      caption,
    })
    .returning({ id: photos.id });
  return NextResponse.json({ id: row.id, url: `/api/photos/${row.id}` });
}
