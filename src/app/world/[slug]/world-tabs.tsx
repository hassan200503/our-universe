"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorldTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="World sections" className="-mx-4 mt-8 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
      {tabs.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? path === base : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-sm transition-colors ${active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
