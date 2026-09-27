"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; emoji: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      {links.map((l) => {
        const active = l.href === "/discover" ? path === "/discover" : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${active ? "bg-surface-2 font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            <span aria-hidden className="mr-1">
              {l.emoji}
            </span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
