"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { commentOnMedia, deleteComment, deleteMedia, reactToMedia, setAvatarFromMedia } from "@/lib/actions/media";
import type { MediaCard } from "@/lib/media/queries";
import { Avatar } from "@/components/avatar";
import { useMe, useMembers } from "@/components/me-context";
import { ago, day } from "@/lib/ui/time";

const EMOJI = ["❤️", "😍", "🥹", "😂", "🔥", "😮"];

type Comment = { id: string; body: string; createdAt: string; slug: string; name: string; mine: boolean };

function Stage({ item }: { item: MediaCard }) {
  if (item.youtubeId) {
    return (
      <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
        <iframe
          key={item.youtubeId}
          src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={item.title ?? "YouTube"}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }
  if (item.kind === "video" && item.url) {
    return <video key={item.id} src={item.url} poster={item.thumbUrl ?? undefined} controls autoPlay playsInline preload="metadata" className="max-h-[70dvh] max-w-full rounded-2xl bg-black shadow-2xl" />;
  }
  if (item.kind === "song" && item.url) {
    return (
      <div data-world={item.by.theme} className="w-full max-w-md rounded-3xl bg-gradient-to-br from-accent to-accent-2 p-8 text-center text-white shadow-2xl">
        <p className="text-6xl" aria-hidden>
          ♪
        </p>
        <p className="font-display mt-4 text-2xl font-semibold">{item.title ?? "A song"}</p>
        {item.artist && <p className="opacity-80">{item.artist}</p>}
        <audio key={item.id} src={item.url} controls autoPlay preload="metadata" className="mt-6 w-full" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
    <img key={item.id} src={item.url ?? item.thumbUrl ?? ""} alt={item.caption ?? "A photo from our gallery"} className="max-h-[72dvh] max-w-full rounded-2xl object-contain shadow-2xl" />
  );
}

/** Full-screen viewer: swipe or arrow through everything, react, comment, play together. */
export function Viewer({ items, index, onIndex, onClose, onChanged }: { items: MediaCard[]; index: number; onIndex: (i: number) => void; onClose: () => void; onChanged: () => void }) {
  const item = items[index];
  const me = useMe();
  const members = useMembers();
  const router = useRouter();
  const [pending, start] = useTransition();
  // My reaction per item, overriding the server copy until the list refetches.
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const mine = item.id in picked ? picked[item.id] : (item.reactions[me.slug] ?? null);
  const setMine = (v: string | null) => setPicked((p) => ({ ...p, [item.id]: v }));
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const touch = useRef<number | null>(null);

  const comments = useQuery({
    queryKey: ["media", item.id],
    queryFn: async () => (await (await fetch(`/api/gallery/${item.id}`)).json()) as { comments: Comment[] },
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [index, items.length, onIndex, onClose]);

  // Warm the next photo so arrowing through feels instant.
  useEffect(() => {
    const next = items[index + 1];
    if (next?.kind === "photo" && next.url) new Image().src = next.url;
  }, [index, items]);

  const who = members.find((m) => m.slug === item.by.slug);
  const say = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  };

  async function playTogether() {
    const res = await fetch("/api/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "load", mediaId: item.id, play: true }) });
    if (res.ok) router.push("/together");
    else say("Couldn't start the room — try again");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gallery viewer"
      className="fixed inset-0 z-[80] flex flex-col bg-black/92 text-white backdrop-blur-sm lg:flex-row"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (dx < -60 && index < items.length - 1) onIndex(index + 1);
        if (dx > 60 && index > 0) onIndex(index - 1);
        touch.current = null;
      }}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20" aria-label="Close">
          ✕
        </button>
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} className="absolute left-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/20 sm:grid" aria-label="Previous">
            ‹
          </button>
        )}
        {index < items.length - 1 && (
          <button onClick={() => onIndex(index + 1)} className="absolute right-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/20 sm:grid" aria-label="Next">
            ›
          </button>
        )}
        <Stage item={item} />
      </div>

      <aside className="max-h-[42dvh] w-full shrink-0 overflow-y-auto bg-zinc-950/80 p-4 lg:max-h-none lg:w-96">
        <div className="flex items-center gap-3">
          {who && <Avatar name={who.displayName} url={who.avatarUrl} theme={who.theme} size={36} />}
          <div className="text-sm">
            <p className="font-semibold">{item.by.name.split(" ")[0]}</p>
            <p className="text-xs text-white/60" suppressHydrationWarning>
              {item.takenOn ? `${day(item.takenOn)} · ` : ""}shared {ago(item.createdAt)}
            </p>
          </div>
        </div>
        {item.kind === "song" && item.title && <p className="font-display mt-3 text-lg">{item.title}{item.artist ? ` — ${item.artist}` : ""}</p>}
        {item.caption && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{item.caption}</p>}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              disabled={pending}
              onClick={() => {
                const next = mine === e ? null : e;
                setMine(next);
                start(async () => {
                  await reactToMedia(item.id, next);
                  onChanged();
                });
              }}
              className={`grid size-10 place-items-center rounded-full text-xl transition ${mine === e ? "scale-110 bg-white/25" : "bg-white/5 hover:bg-white/15"}`}
              aria-pressed={mine === e}
            >
              {e}
            </button>
          ))}
        </div>
        {Object.entries(item.reactions).filter(([s]) => s !== me.slug).length > 0 && (
          <p className="mt-2 text-xs text-white/70">
            {Object.entries(item.reactions)
              .filter(([s]) => s !== me.slug)
              .map(([s, e]) => `${members.find((m) => m.slug === s)?.displayName.split(" ")[0]} ${e}`)
              .join(" · ")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {item.kind !== "photo" && (
            <button data-world="us" onClick={playTogether} className="btn">
              🎧 Play together
            </button>
          )}
          {item.kind === "photo" && (
            <button
              className="btn btn-ghost border-white/20 text-white"
              onClick={() =>
                start(async () => {
                  const r = await setAvatarFromMedia(item.id);
                  say(r.ok ? "It's your profile picture now ❤️" : (r.error ?? "Couldn't set it"));
                  if (r.ok) router.refresh();
                })
              }
            >
              👤 Set as my profile picture
            </button>
          )}
          {item.url && (
            <a href={item.url} download className="btn btn-ghost border-white/20 text-white">
              ⬇ Save
            </a>
          )}
          {item.by.slug === me.slug && (
            <button
              className="btn btn-ghost border-white/20 text-white hover:text-red-300"
              onClick={() => {
                if (!confirm("Delete this for both of you?")) return;
                start(async () => {
                  const r = await deleteMedia(item.id);
                  if (r.ok) {
                    onChanged();
                    onClose();
                  } else say(r.error ?? "Couldn't delete");
                });
              }}
            >
              🗑 Delete
            </button>
          )}
        </div>
        {flash && (
          <p role="status" className="mt-2 text-sm text-pink-300">
            {flash}
          </p>
        )}

        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-sm font-semibold">Comments</p>
          <ul className="mt-2 space-y-2">
            {comments.data?.comments.map((c) => (
              <li key={c.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="font-semibold">{c.name.split(" ")[0]}</span> {c.body}
                <span className="ml-2 text-[0.65rem] text-white/50" suppressHydrationWarning>
                  {ago(c.createdAt)}
                </span>
                {c.mine && (
                  <button
                    className="ml-2 text-[0.65rem] text-white/50 hover:text-red-300"
                    onClick={() => start(async () => void (await deleteComment(c.id), comments.refetch()))}
                  >
                    delete
                  </button>
                )}
              </li>
            ))}
            {comments.data && !comments.data.comments.length && <li className="text-xs text-white/50">Say something sweet.</li>}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = text;
              if (!body.trim()) return;
              setText("");
              start(async () => {
                await commentOnMedia(item.id, body);
                comments.refetch();
                onChanged();
              });
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-pink-300" aria-label="Comment" />
            <button className="rounded-full bg-white px-4 text-sm font-semibold text-black" disabled={pending}>
              Send
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[0.7rem] text-white/40">
          {index + 1} of {items.length}
          {items.length > 1 ? " · swipe or use ← →" : ""}
        </p>
      </aside>
    </div>
  );
}
