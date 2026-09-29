import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: sends visitors without a session cookie to /login. The
 * cookie's signature is verified server-side on every page and action
 * (src/lib/context.ts), so this is only a fast path, never the authority.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ou_session")) {
    const url = new URL("/login", request.url);
    // Keep the whole destination (e.g. a call notification's ?call=…) so sign-in lands exactly there.
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Public: sign-in, public profiles, the cron endpoint (secret-protected), static assets,
  // the service worker and app manifest (browsers fetch these without following redirects),
  // and the call API, which checks every request itself (a signed "Decline" from a notification
  // must reach it from a signed-out device).
  matcher: ["/((?!login|p/|api/cron|api/call|_next/static|_next/image|favicon.ico|icon|apple-icon|apple-touch-icon.png|robots.txt|sw.js|manifest.webmanifest).*)"],
};
