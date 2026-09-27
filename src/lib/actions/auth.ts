"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { createSession, destroySession } from "@/lib/auth/session";
import type { ActionState } from "./util";

// Slows guessing from one address. Resets on redeploy, which is fine: bcrypt
// (cost 12) is the real brake on brute force.
const attempts = new Map<string, { n: number; until: number }>();

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const slug = String(fd.get("slug") ?? "");
  const passcode = String(fd.get("passcode") ?? "");
  const next = String(fd.get("next") ?? "/");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${slug}`;
  const a = attempts.get(key);
  if (a && a.n >= 5 && a.until > Date.now()) {
    return { error: `Too many tries. Wait ${Math.ceil((a.until - Date.now()) / 60000)} minute(s).` };
  }

  const db = await getDb();
  const [person] = await db.select().from(people).where(eq(people.slug, slug));
  const ok = person ? await bcrypt.compare(passcode, person.passwordHash) : false;
  if (!ok || !person) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(key, { n, until: Date.now() + 5 * 60_000 });
    return { error: "That passcode doesn't match." };
  }
  attempts.delete(key);
  await createSession({ personId: person.id, slug: person.slug });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
