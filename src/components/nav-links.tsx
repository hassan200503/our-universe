"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePulse } from "./pulse";

export function NavLinks({ links }: { links: { href: string; label: string; emoji: string; badge?: "gallery" }[] }) {
  const path = usePathname();
  const { data } = usePulse();
  return (
    <nav aria-label="Main" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      {links.map((l) => {
        const active = l.href === "/discover" ? path === "/discover" : path === l.href || path.startsWith(`${l.href}/`);
        const badge = l.badge === "gallery" ? (data?.unseenGallery ?? 0) : 0;
        const room = l.href === "/together" && data?.partners.some((p) => p.place === "room");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${active ? "bg-surface-2 font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            <span aria-hidden className="mr-1">
              {l.emoji}
            </span>
            {l.label}
            {badge > 0 && (
              <span data-world="us" className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-bold text-accent-ink">
                {badge}
                <span className="sr-only"> new</span>
              </span>
            )}
            {room && <span className="ml-1.5 inline-block size-2 animate-pulse rounded-full bg-emerald-500" aria-label="Your partner is in the room" />}
          </Link>
        );
      })}
    </nav>
  );
}
