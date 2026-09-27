import "server-only";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/context";

/** Resolves /world/[slug] to a relationship member, or 404. */
export async function worldPerson(params: Promise<{ slug: string }>) {
  const ctx = await requireCtx();
  const { slug } = await params;
  const person = ctx.members.find((m) => m.slug === slug);
  if (!person) notFound();
  return { ctx, person, own: person.id === ctx.me.id, first: person.displayName.split(" ")[0] };
}
