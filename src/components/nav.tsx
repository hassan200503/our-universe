import Link from "next/link";
import { getCtx } from "@/lib/context";
import { logout } from "@/lib/actions/auth";
import { NavLinks } from "./nav-links";
import { BottomNav } from "./bottom-nav";

export async function Nav() {
  const ctx = await getCtx();
  if (!ctx) return null;
  const links = [
    { href: "/story", label: "Our Story", emoji: "❤️" },
    ...ctx.members.map((m) => ({ href: `/world/${m.slug}`, label: `${m.displayName.split(" ")[0]}'s World`, emoji: m.theme === "hassan" ? "💻" : m.theme === "whitney" ? "🧬" : "✨" })),
    { href: "/discover", label: "For You", emoji: "✨" },
    { href: "/discover/together", label: "Together", emoji: "🔗" },
    { href: "/learning", label: "Learning", emoji: "📚" },
    { href: "/search", label: "Search", emoji: "🔎" },
  ];
  return (
    <>
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight whitespace-nowrap" data-world="us">
          Our Universe <span className="text-accent">❤</span>
        </Link>
        <div className="hidden min-w-0 flex-1 sm:flex">
          <NavLinks links={links} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/settings" data-world={ctx.me.theme} aria-label="Settings" title="Settings" className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink">
            {ctx.me.displayName[0]}
          </Link>
          <form action={logout}>
            <button className="hidden text-sm text-muted hover:text-ink sm:inline" aria-label="Sign out">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
    <BottomNav worldHref={`/world/${ctx.me.slug}`} />
    </>
  );
}
