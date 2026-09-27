import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { getCtx } from "@/lib/context";
import { Universe } from "@/components/universe";
import { LoginForm } from "./login-form";

export const metadata = { title: "Welcome home" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCtx()) redirect("/");
  const { next } = await searchParams;
  const db = await getDb();
  const everyone = await db.select({ slug: people.slug, displayName: people.displayName, theme: people.theme }).from(people).orderBy(asc(people.createdAt));
  const names = everyone.map((p) => p.displayName.split(" ")[0]);
  return (
    <div data-world="us" className="bg-us grain relative flex min-h-dvh items-center overflow-hidden">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 py-12 md:grid-cols-2">
        <div className="order-2 flex justify-center md:order-1">
          <Universe left={names[0] ?? ""} right={names[1] ?? ""} size={460} />
        </div>
        <div className="order-1 text-center md:order-2 md:text-left rise">
          <p className="eyebrow">Our Universe</p>
          <h1 className="display-xl mt-4">
            Welcome <span className="text-gradient">home.</span>
          </h1>
          <p className="mt-4 text-lg text-muted">Two worlds, one story. Who&apos;s here?</p>
          <LoginForm people={everyone} next={typeof next === "string" ? next : "/"} />
        </div>
      </div>
    </div>
  );
}
