"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Phone navigation: the five places people go most, always under the thumb. */
export function BottomNav({ worldHref }: { worldHref: string }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Home", icon: "✦", match: (p: string) => p === "/" },
    { href: "/story", label: "Story", icon: "❤", match: (p: string) => p.startsWith("/story") },
    { href: worldHref, label: "Worlds", icon: "◐", match: (p: string) => p.startsWith("/world") },
    { href: "/discover", label: "Discover", icon: "✧", match: (p: string) => p.startsWith("/discover") },
    { href: "/search", label: "Search", icon: "⌕", match: (p: string) => p.startsWith("/search") || p.startsWith("/learning") },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-line bg-surface/85 px-2 py-1.5 shadow-lg backdrop-blur-xl sm:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
      <ul className="grid grid-cols-5">
        {items.map((i) => {
          const on = i.match(path);
          return (
            <li key={i.label}>
              <Link href={i.href} aria-current={on ? "page" : undefined} data-world="us" className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.68rem] font-semibold ${on ? "bg-accent-soft text-accent" : "text-muted"}`}>
                <span aria-hidden className="text-lg leading-none">
                  {i.icon}
                </span>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
