import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, handleUploadPresigned, type HandleUploadBody } from "@vercel/blob/client";
import { getCtx } from "@/lib/context";
import { ALLOWED_TYPES, LIMITS, ownsPath } from "@/lib/media/storage";

/** Size cap for an object path, by its folder: rel/<id>/<folder>/<file>. */
function limitFor(pathname: string): number {
  const folder = pathname.split("/")[2];
  if (folder === "avatar" || folder === "thumb") return LIMITS.thumb;
  return LIMITS[folder as keyof typeof LIMITS] ?? LIMITS.photo;
}

async function authorize(pathname: string) {
  const ctx = await getCtx();
  if (!ctx) throw new Error("Sign in first");
  if (!ownsPath(ctx.relationship.id, pathname)) throw new Error("Not your folder");
  return {
    allowedContentTypes: ALLOWED_TYPES,
    maximumSizeInBytes: limitFor(pathname),
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    validUntil: Date.now() + 60 * 60 * 1000,
  };
}

/**
 * Lets browsers upload straight to private Blob storage, one object at a time.
 * Only signed-in members, only into their own relationship's folder, only
 * media types, with a size cap per kind.
 *
 * Stores connected with OIDC (the Vercel default) get presigned upload URLs;
 * stores with a read-write token get classic client tokens.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const result = await handleUpload({ body: body as HandleUploadBody, request: req, onBeforeGenerateToken: (pathname) => authorize(pathname) });
      return NextResponse.json(result);
    }
    const { issueSignedToken } = await import("@vercel/blob");
    const result = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname) => {
        const urlOptions = await authorize(pathname);
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: urlOptions.validUntil,
          allowedContentTypes: urlOptions.allowedContentTypes,
          maximumSizeInBytes: urlOptions.maximumSizeInBytes,
        });
        return { token, urlOptions };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload refused" }, { status: 400 });
  }
}
