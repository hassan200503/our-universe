import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCtx } from "@/lib/context";
import { ALLOWED_TYPES, LIMITS, ownsPath } from "@/lib/media/storage";

/**
 * Issues short-lived client tokens so browsers upload straight to private
 * Blob storage. Only signed-in members, only into their own relationship's
 * folder, only media types, with a size cap per kind.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await getCtx();
        if (!ctx) throw new Error("Sign in first");
        if (!ownsPath(ctx.relationship.id, pathname)) throw new Error("Not your folder");
        const folder = pathname.split("/")[2] as keyof typeof LIMITS | "avatar";
        const max = folder === "avatar" ? LIMITS.thumb : (LIMITS[folder as keyof typeof LIMITS] ?? LIMITS.photo);
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: max,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload refused" }, { status: 400 });
  }
}
