import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { people, relationshipMembers, relationships, type Person } from "@/lib/db/schema";
import { readSession } from "@/lib/auth/session";
import { viewUrl } from "@/lib/media/storage";

export type PublicPerson = Omit<Person, "passwordHash"> & { avatarUrl: string | null };

async function strip(p: Person): Promise<PublicPerson> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = p;
  const avatarUrl = p.avatarPath ? await viewUrl(p.avatarPath).catch(() => null) : null;
  return { ...rest, avatarUrl };
}

export type Ctx = {
  me: PublicPerson;
  relationship: typeof relationships.$inferSelect;
  /** Everyone else in the relationship (one person today, but not assumed). */
  partners: PublicPerson[];
  members: PublicPerson[];
};

/** The signed-in person and their relationship, or null. Cached per request. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const session = await readSession();
  if (!session) return null;
  const db = await getDb();
  const [me] = await db.select().from(people).where(eq(people.id, session.personId));
  if (!me) return null;
  const [link] = await db
    .select({ r: relationships })
    .from(relationshipMembers)
    .innerJoin(relationships, eq(relationships.id, relationshipMembers.relationshipId))
    .where(eq(relationshipMembers.personId, me.id))
    .limit(1);
  if (!link) return null;
  const others = await db
    .select({ p: people })
    .from(relationshipMembers)
    .innerJoin(people, eq(people.id, relationshipMembers.personId))
    .where(and(eq(relationshipMembers.relationshipId, link.r.id), ne(people.id, me.id)));
  const [meP, ...partners] = await Promise.all([strip(me), ...others.map((o) => strip(o.p))]);
  return { me: meP, relationship: link.r, partners, members: [meP, ...partners] };
});

/** For pages and actions: the context, or a redirect to sign in. */
export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

/** A relationship member by slug, or null. Outsiders can never be resolved here. */
export async function memberBySlug(ctx: Ctx, slug: string): Promise<PublicPerson | null> {
  return ctx.members.find((m) => m.slug === slug) ?? null;
}

/**
 * Visibility rule used everywhere: the owner sees everything; other members of
 * the relationship see "shared" and "public"; nobody else sees anything but
 * "public" (and only via the public profile).
 */
export function visibleTo(ctx: Ctx, ownerId: string): ("private" | "shared" | "public")[] {
  return ctx.me.id === ownerId ? ["private", "shared", "public"] : ["shared", "public"];
}
