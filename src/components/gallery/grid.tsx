"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaCard } from "@/lib/media/queries";
import { markGallerySeen } from "@/lib/actions/media";
import { Avatar } from "@/components/avatar";
import { useMembers } from "@/components/me-context";
import { Viewer } from "./viewer";

const TABS = [
  { k: null, label: "Everything", icon: "✨" },
  { k: "photo", label: "Photos", icon: "📸" },
  { k: "video", label: "Videos", icon: "🎬" },
  { k: "song", label: "Songs", icon: "🎵" },
] as const;

const fmt = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");

function Tile({ item, onOpen }: { item: MediaCard; onOpen: () => void }) {
  const members = useMembers();
  const who = members.find((m) => m.slug === item.by.slug);
  const [loaded, setLoaded] = useState(false);
  const reactions = Object.values(item.reactions);
  return (
    <button type="button" onClick={onOpen} className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-surface-2 text-left focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Open ${item.kind}${item.title ? `: ${item.title}` : ""}`}>
      {item.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed private thumbnails, already 480px
        <img src={item.thumbUrl} alt={item.caption ?? item.title ?? ""} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} className={`size-full object-cover transition duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`} />
      ) : (
        <span data-world={item.by.theme} className="grid size-full place-items-center bg-gradient-to-br from-accent to-accent-2 text-5xl text-white">
          ♪
        </span>
      )}
      {!loaded && item.thumbUrl && <span className="absolute inset-0 animate-pulse bg-surface-2" />}
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
      {item.kind !== "photo" && (
        <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg text-black shadow-lg transition group-hover:scale-110">
          {item.kind === "song" ? "♪" : "▶"}
        </span>
      )}
      {item.isNew && <span data-world="us" className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-ink shadow">NEW</span>}
      <span className="absolute right-2 top-2">{who && <Avatar name={who.displayName} url={who.avatarUrl} theme={who.theme} size={24} />}</span>
      <span className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 text-white">
        <span className="min-w-0 text-xs font-semibold leading-tight drop-shadow">
          {item.kind === "song" ? <span className="line-clamp-2">{item.title ?? "Song"}</span> : item.caption ? <span className="line-clamp-2">{item.caption}</span> : null}
        </span>
        <span className="shrink-0 text-xs drop-shadow">
          {reactions.join("")}
          {item.comments > 0 && ` 💬${item.comments}`}
          {item.durationSec ? ` ${fmt(item.durationSec)}` : ""}
        </span>
      </span>
    </button>
  );
}

export function GalleryGrid({ initialKind }: { initialKind?: string | null }) {
  const members = useMembers();
  const [kind, setKind] = useState<string | null>(initialKind ?? null);
  const [by, setBy] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const q = useInfiniteQuery({
    queryKey: ["gallery", kind, by],
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (kind) qs.set("kind", kind);
      if (by) qs.set("by", by);
      if (pageParam) qs.set("cursor", pageParam);
      const res = await fetch(`/api/gallery?${qs}`);
      if (!res.ok) throw new Error("Couldn't load the gallery");
      return (await res.json()) as { items: MediaCard[]; nextCursor: string | null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  // Opening the gallery counts as having seen what's new (after a moment, so the badges are visible first).
  useEffect(() => {
    const t = setTimeout(() => markGallerySeen(), 4000);
    return () => clearTimeout(t);
  }, []);

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.label} onClick={() => setKind(t.k)} className={`chip ${kind === t.k ? "ring-1 ring-accent" : "bg-transparent text-muted"}`} aria-pressed={kind === t.k}>
            {t.icon} {t.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <button onClick={() => setBy(null)} className={`chip ${!by ? "ring-1 ring-accent" : "bg-transparent text-muted"}`} aria-pressed={!by}>
          Both of us
        </button>
        {members.map((m) => (
          <button key={m.slug} onClick={() => setBy(m.slug)} className={`chip gap-1.5 ${by === m.slug ? "ring-1 ring-accent" : "bg-transparent text-muted"}`} aria-pressed={by === m.slug}>
            <Avatar name={m.displayName} url={m.avatarUrl} theme={m.theme} size={18} /> {m.displayName.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {items.map((it, i) => (
          <Tile key={it.id} item={it} onOpen={() => setOpen(i)} />
        ))}
        {(q.isPending || isFetchingNextPage) && Array.from({ length: q.isPending ? 8 : 4 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-2" />)}
      </div>
      {q.isSuccess && items.length === 0 && (
        <div className="card mt-4 p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🌹
          </p>
          <p className="font-display mt-3 text-xl font-semibold">Your gallery is waiting for its first memory</p>
          <p className="mt-1 text-muted">A selfie, a voice note, a song that reminds you of each other — whatever you share appears here for both of you.</p>
        </div>
      )}
      {q.isError && <p className="card mt-4 p-6 text-center text-muted">Couldn&apos;t load the gallery just now. It will retry by itself.</p>}
      <div ref={sentinel} className="h-px" />

      {open !== null && items[open] && (
        <Viewer
          items={items}
          index={open}
          onIndex={(i) => {
            setOpen(i);
            if (i >= items.length - 3 && hasNextPage) fetchNextPage();
          }}
          onClose={() => setOpen(null)}
          onChanged={() => q.refetch()}
        />
      )}
    </section>
  );
}
