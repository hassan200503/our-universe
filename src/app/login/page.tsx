import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { getCtx } from "@/lib/context";
import { pick, parseVerse, VERSE_COOKIE, VERSES } from "@/lib/journey/verses";
import { Orbit, Starfield } from "@/components/home/sky";
import { RememberLines } from "@/components/home/remember";
import { Monogram } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata = { title: "Our Universe" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCtx()) redirect("/");
  const { next } = await searchParams;
  const db = await getDb();
  const everyone = await db.select({ slug: people.slug, displayName: people.displayName, theme: people.theme }).from(people).orderBy(asc(people.createdAt));
  const names = everyone.map((p) => p.displayName.split(" ")[0]);
  const verse = pick(VERSES, (await cookies()).get(VERSE_COOKIE)?.value);
  let i = 0;
  return (
    <div className="min-h-dvh bg-[#07060a] p-0 sm:p-4">
      <RememberLines cookies={{ [VERSE_COOKIE]: verse.remember }} />
      <div className="stage relative flex min-h-dvh items-center sm:min-h-[calc(100dvh-2rem)] sm:rounded-[36px]">
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <Starfield count={180} />
        <div className="pointer-events-none absolute -right-40 top-1/2 w-[760px] -translate-y-1/2 opacity-30 lg:-right-24 lg:opacity-45" aria-hidden>
          <Orbit left={names[0] ?? ""} right={names[1] ?? ""} className="h-auto w-full" />
        </div>
        <div className="relative z-[3] mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-14 sm:px-10 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="fade-late flex items-center gap-3" style={{ "--d": "0ms" } as React.CSSProperties}>
              <Monogram size={34} />
              <span className="eyebrow-lux">Our Universe</span>
            </div>
            <h1 className="verse font-lux mt-10 text-balance text-[2.6rem] leading-[1.04] tracking-[-0.012em] text-[#f7efe1] sm:text-[3.8rem] lg:text-[4.4rem]">
              {parseVerse(verse.text).map((part, p) =>
                part.t.split(/(\s+)/).map((w, k) =>
                  /^\s+$/.test(w) ? (
                    <span key={`${p}-${k}`}> </span>
                  ) : w ? (
                    <span key={`${p}-${k}`} className={`w ${part.em ? "gold-shimmer italic" : ""}`} style={{ "--i": i++ } as React.CSSProperties}>
                      {w}
                    </span>
                  ) : null,
                ),
              )}
            </h1>
            {names.length > 1 && (
              <div className="fade-late mt-9 flex items-center gap-4" style={{ "--d": "1000ms" } as React.CSSProperties}>
                <span className="rule-gold w-14" aria-hidden />
                <p className="text-[0.72rem] uppercase tracking-[0.3em] text-white/60">{names.join(" & ")}</p>
              </div>
            )}
          </div>
          <div className="fade-late" style={{ "--d": "600ms" } as React.CSSProperties}>
            <LoginForm people={everyone} next={typeof next === "string" ? next : "/"} />
          </div>
        </div>
      </div>
    </div>
  );
}
