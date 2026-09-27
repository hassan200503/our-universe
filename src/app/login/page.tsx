import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { getCtx } from "@/lib/context";
import { LoginForm } from "./login-form";

export const metadata = { title: "Welcome" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCtx()) redirect("/");
  const { next } = await searchParams;
  const db = await getDb();
  const everyone = await db.select({ slug: people.slug, displayName: people.displayName, theme: people.theme }).from(people).orderBy(asc(people.createdAt));
  return (
    <div data-world="us" className="bg-us flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center rise">
        <p className="eyebrow">Our Universe</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Welcome home.</h1>
        <p className="mt-3 text-muted">Two worlds, one story. Who&apos;s here?</p>
        <LoginForm people={everyone} next={typeof next === "string" ? next : "/"} />
      </div>
    </div>
  );
}
