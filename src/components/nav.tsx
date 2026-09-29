import Link from "next/link";
import { getCtx } from "@/lib/context";
import { Avatar } from "./avatar";
import { BottomNav } from "./bottom-nav";
import { IconSearch, Monogram } from "./icons";
import { HeaderShell, MessagesButton, NavLinks } from "./nav-links";
import { PresencePill } from "./presence-pill";

export async function Nav() {
  const ctx = await getCtx();
  if (!ctx) return null;
  const links = [
    { href: "/story", label: "Our Story" },
    { href: "/gallery", label: "Gallery", badge: "gallery" as const },
    { href: "/together", label: "Together", badge: "together" as const },
    ...ctx.members.map((m) => ({ href: `/world/${m.slug}`, label: `${m.displayName.split(" ")[0]}'s World` })),
    { href: "/discover", label: "For You" },
    { href: "/learning", label: "Learning" },
  ];
  return (
    <>
      <HeaderShell>
        <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center gap-5 px-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Our Universe, home">
            <Monogram size={28} className="transition-transform duration-700 group-hover:rotate-[24deg]" />
            <span className="font-lux text-[1.4rem] font-medium leading-none tracking-tight">Our Universe</span>
          </Link>
          <div className="hidden min-w-0 flex-1 sm:flex">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink">
              <IconSearch size={19} />
            </Link>
            <MessagesButton />
            <PresencePill />
            <Link href="/settings" aria-label="Your settings" title="Settings" className="ml-1 rounded-full">
              <Avatar name={ctx.me.displayName} url={ctx.me.avatarUrl} theme={ctx.me.theme} size={32} />
            </Link>
          </div>
        </div>
      </HeaderShell>
      <BottomNav />
    </>
  );
}
