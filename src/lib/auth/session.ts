import "server-only";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ou_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days: this is a personal site on personal devices.

/**
 * Signing key for session cookies. SESSION_SECRET wins when set; otherwise the
 * key is derived from DATABASE_URL (which already holds the database password,
 * so it is at least as secret), so a deployment needs only one setting.
 * Resetting the database password therefore also signs everyone out.
 */
function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  const db = process.env.DATABASE_URL;
  if (db) return new Uint8Array(createHmac("sha256", db).update("our-universe/session-v1").digest());
  if (process.env.NODE_ENV === "production") throw new Error("Set DATABASE_URL (or SESSION_SECRET) in production");
  return new TextEncoder().encode("dev-only-secret-not-for-production-use-000");
}

export type Session = { personId: string; slug: string };

export async function createSession(s: Session) {
  const token = await new SignJWT({ slug: s.slug })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.personId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.slug !== "string") return null;
    return { personId: payload.sub, slug: payload.slug };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
