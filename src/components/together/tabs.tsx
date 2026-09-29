"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHeadphones, IconMessage } from "@/components/icons";
import { usePulse } from "@/components/pulse";

/** Together has two rooms: the one you listen and watch in, and your messages. */
export function TogetherTabs() {
  const path = usePathname();
  const unread = usePulse().data?.chat?.unread ?? 0;
  const tabs = [
    { href: "/together", label: "Listen & watch", Icon: IconHeadphones, on: path === "/together" },
    { href: "/together/chat", label: "Messages", Icon: IconMessage, on: path.startsWith("/together/chat"), badge: unread },
  ];
  return (
    <nav aria-label="Together" className="inline-flex rounded-full border border-line bg-surface p-1 shadow-sm">
      {tabs.map(({ Icon, ...t }) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.on ? "page" : undefined}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${t.on ? "bg-ink text-bg shadow" : "text-muted hover:text-ink"}`}
        >
          <Icon size={16} /> {t.label}
          {!!t.badge && <span className="rounded-full bg-emerald-500 px-1.5 text-[0.65rem] font-bold leading-4 text-white">{t.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
