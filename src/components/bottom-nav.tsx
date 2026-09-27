"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePulse } from "./pulse";

/** Phone navigation: the places you go most, always under the thumb. */
export function BottomNav() {
  const path = usePathname();
  const { data } = usePulse();
  const partnerInRoom = data?.partners.some((p) => p.place === "room");
  const items = [
    { href: "/", label: "Home", icon: "✦", match: (p: string) => p === "/" || p.startsWith("/world") },
    { href: "/story", label: "Story", icon: "❤", match: (p: string) => p.startsWith("/story") },
    { href: "/gallery", label: "Gallery", icon: "📸", match: (p: string) => p.startsWith("/gallery"), badge: data?.unseenGallery ?? 0 },
    { href: "/together", label: "Together", icon: "🎧", match: (p: string) => p.startsWith("/together"), live: partnerInRoom },
    { href: "/discover", label: "Discover", icon: "✧", match: (p: string) => p.startsWith("/discover") || p.startsWith("/learning") },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-line bg-surface/85 px-2 py-1.5 shadow-lg backdrop-blur-xl sm:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
      <ul className="grid grid-cols-5">
        {items.map((i) => {
          const on = i.match(path);
          return (
            <li key={i.label}>
              <Link href={i.href} aria-current={on ? "page" : undefined} data-world="us" className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.68rem] font-semibold ${on ? "bg-accent-soft text-accent" : "text-muted"}`}>
                <span aria-hidden className="text-lg leading-none">
                  {i.icon}
                </span>
                {i.label}
                {!!i.badge && <span className="absolute right-2 top-0.5 rounded-full bg-accent px-1.5 text-[0.6rem] text-accent-ink">{i.badge}</span>}
                {i.live && <span className="absolute right-3 top-1 size-2 animate-pulse rounded-full bg-emerald-500" aria-label="Your partner is in the room" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
