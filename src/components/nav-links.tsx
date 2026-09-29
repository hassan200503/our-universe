"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMessage } from "./icons";
import { usePulse } from "./pulse";

/** The chat takes the whole screen on phones, so the header steps aside there. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const chat = path.startsWith("/together/chat");
  return <header className={`glass sticky top-0 z-30 border-b border-line/80 ${chat ? "max-sm:hidden" : ""}`}>{children}</header>;
}

export function NavLinks({ links }: { links: { href: string; label: string; badge?: "gallery" | "together" }[] }) {
  const path = usePathname();
  const { data } = usePulse();
  return (
    <nav aria-label="Main" className="scrollbar-none -mx-1 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1">
      {links.map((l) => {
        const active = l.href === "/discover" ? path === "/discover" : path === l.href || path.startsWith(`${l.href}/`);
        const badge = l.badge === "gallery" ? (data?.unseenGallery ?? 0) : 0;
        const live = l.badge === "together" && data?.partners.some((p) => p.place === "room");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center whitespace-nowrap rounded-full px-3 py-2 text-[0.84rem] transition-colors ${active ? "font-medium text-ink" : "text-muted hover:text-ink"}`}
          >
            {l.label}
            {badge > 0 && (
              <span data-world="us" className="ml-1.5 rounded-full bg-accent px-1.5 py-px text-[0.62rem] font-bold text-accent-ink">
                {badge}
                <span className="sr-only"> new</span>
              </span>
            )}
            {live && <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" aria-label="Your partner is in the room" />}
            {active && <span className="absolute inset-x-3 -bottom-[0.6rem] h-px bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Messages, with the unread count, one tap from anywhere. */
export function MessagesButton() {
  const { data } = usePulse();
  const path = usePathname();
  const unread = data?.chat?.unread ?? 0;
  const here = path.startsWith("/together/chat");
  return (
    <Link
      href="/together/chat"
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      aria-current={here ? "page" : undefined}
      className={`relative grid size-10 place-items-center rounded-full transition hover:bg-surface-2 hover:text-ink ${here ? "text-ink" : "text-muted"}`}
    >
      <IconMessage size={20} />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-emerald-500 px-1 text-[0.62rem] font-bold leading-[1.1rem] text-white ring-2 ring-bg">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
