import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { LOCAL_ROOT, ownsPath, storageMode } from "@/lib/media/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav", weba: "audio/webm" };

/** Development-only file server with Range support so videos can seek. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/media/file/[...path]">) {
  if (storageMode() !== "local") return new NextResponse(null, { status: 404 });
  const ctx = await getCtx();
  if (!ctx) return new NextResponse(null, { status: 401 });
  const p = (await params).path.join("/");
  if (!ownsPath(ctx.relationship.id, p)) return new NextResponse(null, { status: 404 });
  const file = path.join(LOCAL_ROOT, p);
  const info = await stat(file).catch(() => null);
  if (!info) return new NextResponse(null, { status: 404 });
  const type = TYPES[p.split(".").pop() ?? ""] ?? "application/octet-stream";
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable" };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    return new NextResponse(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { ...headers, "Content-Length": String(info.size) } });
}
