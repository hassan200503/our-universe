"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCompass, IconFlask, IconHeadphones, IconHeart, IconHome, IconImage } from "./icons";
import { usePulse } from "./pulse";

/** Phone navigation: the places you go most, always under the thumb. */
export function BottomNav() {
  const path = usePathname();
  const { data } = usePulse();
  if (path.startsWith("/together/chat")) return null;
  const partnerInRoom = data?.partners.some((p) => p.place === "room");
  const items = [
    { href: "/", label: "Home", Icon: IconHome, match: (p: string) => p === "/" || p.startsWith("/world") },
    { href: "/story", label: "Story", Icon: IconHeart, match: (p: string) => p.startsWith("/story") },
    { href: "/gallery", label: "Gallery", Icon: IconImage, match: (p: string) => p.startsWith("/gallery"), badge: data?.unseenGallery ?? 0 },
    { href: "/together", label: "Together", Icon: IconHeadphones, match: (p: string) => p.startsWith("/together"), badge: data?.chat?.unread ?? 0, live: partnerInRoom },
    { href: "/discover", label: "Discover", Icon: IconCompass, match: (p: string) => p.startsWith("/discover") || p.startsWith("/learning") },
    { href: "/research", label: "Research", Icon: IconFlask, match: (p: string) => p.startsWith("/research") },
  ];
  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-3 bottom-3 z-40 rounded-[22px] border border-line px-1.5 py-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.45)] sm:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-6">
        {items.map(({ Icon, ...i }) => {
          const on = i.match(path);
          return (
            <li key={i.label}>
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[0.64rem] font-semibold tracking-wide transition-colors ${on ? "text-ink" : "text-muted"}`}
              >
                <span className={`grid h-7 w-11 place-items-center rounded-full transition-colors ${on ? "bg-gold-soft text-gold" : ""}`}>
                  <Icon size={20} strokeWidth={on ? 1.9 : 1.6} />
                </span>
                {i.label}
                {!!i.badge && <span className="absolute right-1.5 top-0 grid min-w-[1.05rem] place-items-center rounded-full bg-emerald-500 px-1 text-[0.58rem] leading-[1.05rem] text-white ring-2 ring-surface">{i.badge}</span>}
                {i.live && !i.badge && <span className="absolute right-3 top-1 size-2 animate-pulse rounded-full bg-emerald-500" aria-label="Your partner is in the room" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
