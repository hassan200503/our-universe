import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: sends visitors without a session cookie to /login. The
 * cookie's signature is verified server-side on every page and action
 * (src/lib/context.ts), so this is only a fast path, never the authority.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ou_session")) {
    const url = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Public: sign-in, public profiles, the cron endpoint (secret-protected), static assets,
  // and the service worker and app manifest (browsers fetch these without following redirects).
  matcher: ["/((?!login|p/|api/cron|_next/static|_next/image|favicon.ico|icon|apple-icon|apple-touch-icon.png|robots.txt|sw.js|manifest.webmanifest).*)"],
};
