import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { LIMITS, LOCAL_ROOT, ensureLocalDir, ownsPath, storageMode } from "@/lib/media/storage";

/** Development-only upload target (production uses Vercel Blob). */
export async function PUT(req: NextRequest) {
  if (storageMode() !== "local") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const p = req.nextUrl.searchParams.get("path");
  if (!ownsPath(ctx.relationship.id, p)) return NextResponse.json({ error: "Not your folder" }, { status: 403 });
  const folder = p.split("/")[2] as keyof typeof LIMITS;
  const max = LIMITS[folder] ?? LIMITS.thumb;
  if (Number(req.headers.get("content-length") ?? 0) > max) return NextResponse.json({ error: "Too large" }, { status: 413 });
  if (!req.body) return NextResponse.json({ error: "Empty" }, { status: 400 });
  await ensureLocalDir(p);
  await pipeline(Readable.fromWeb(req.body as never), createWriteStream(path.join(LOCAL_ROOT, p)));
  return NextResponse.json({ ok: true });
}
