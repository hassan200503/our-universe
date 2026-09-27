import Link from "next/link";
import { getCtx } from "@/lib/context";
import { logout } from "@/lib/actions/auth";
import { Avatar } from "./avatar";
import { BottomNav } from "./bottom-nav";
import { NavLinks } from "./nav-links";
import { PresencePill } from "./presence-pill";

export async function Nav() {
  const ctx = await getCtx();
  if (!ctx) return null;
  const links = [
    { href: "/story", label: "Our Story", emoji: "❤️" },
    { href: "/gallery", label: "Gallery", emoji: "📸", badge: "gallery" as const },
    { href: "/together", label: "Together", emoji: "🎧" },
    ...ctx.members.map((m) => ({ href: `/world/${m.slug}`, label: `${m.displayName.split(" ")[0]}'s World`, emoji: m.theme === "hassan" ? "💻" : m.theme === "whitney" ? "🧬" : "✨" })),
    { href: "/discover", label: "For You", emoji: "✨" },
    { href: "/learning", label: "Learning", emoji: "📚" },
  ];
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight whitespace-nowrap" data-world="us">
            Our Universe <span className="text-accent">❤</span>
          </Link>
          <div className="hidden min-w-0 flex-1 sm:flex">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/search" aria-label="Search" className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink">
              🔎
            </Link>
            <PresencePill />
            <Link href="/settings" aria-label="Your settings" title="Settings" className="rounded-full">
              <Avatar name={ctx.me.displayName} url={ctx.me.avatarUrl} theme={ctx.me.theme} size={32} />
            </Link>
            <form action={logout} className="hidden lg:block">
              <button className="px-2 text-sm text-muted hover:text-ink" aria-label="Sign out">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <BottomNav />
    </>
  );
}
