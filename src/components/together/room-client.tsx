"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useTransition } from "react";
import type { RoomPayload } from "@/lib/together/room";
import type { MediaCard } from "@/lib/media/queries";
import type { FeedPage } from "@/lib/trends/query";
import { sendNudge } from "@/lib/actions/together";
import { youtubeIdFrom, youtubeThumb } from "@/lib/media/youtube";
import { Avatar } from "@/components/avatar";
import { ChatView } from "@/components/chat/chat-view";
import { IconHeadphones, IconMessage, IconNext, IconPause, IconPlay } from "@/components/icons";
import { useMe, useMembers } from "@/components/me-context";
import { usePulse } from "@/components/pulse";
import { ago } from "@/lib/ui/time";
import { useRoom } from "./room-provider";


const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const REACTIONS = ["❤️", "😂", "😍", "🔥", "😮", "👏", "🥹", "💃"] as const;

export function RoomClient({ initial }: { initial: RoomPayload }) {
  const me = useMe();
  const members = useMembers();
  const { stage, ...room } = useRoom()!;
  const [link, setLink] = useState("");
  const pulse = usePulse();
  const [, startNudge] = useTransition();

  // The player itself lives in the layout (so chat, calls and other pages never stop it); this page
  // hands it the server's first read and marks the box the picture should fill.
  const { activate } = room;
  useEffect(() => activate(initial), [activate, initial]);
  const live = room.active;
  const state = live ? room.state : initial.state;
  const events = live ? room.events : initial.events;
  const partners = live ? room.partners : initial.partners;
  const { key, title, isAudio, ytId, now, dur, volume, inSync, send, togglePlay, seekTo } = room;
  const partnerHere = partners.some((p) => p.here);
  const nameOf = (slug: string) => members.find((m) => m.slug === slug)?.displayName.split(" ")[0] ?? "";
  const partner = members.find((m) => m.id !== me.id);
  const pState = partners.find((p) => p.slug === partner?.slug);
  const status = pState?.here ? "here with you 💞" : pState?.online ? "online, elsewhere on the site" : pState?.lastSeenAt ? `offline · last seen ${ago(pState.lastSeenAt)}` : "offline";

  // Library: our songs and videos, plus video tutorials and bird videos from the feeds.
  const lib = useQuery({
    queryKey: ["room-library"],
    queryFn: async () => {
      const [songs, videos, knit, birds] = await Promise.all([
        fetch("/api/gallery?kind=song").then((r) => r.json() as Promise<{ items: MediaCard[] }>),
        fetch("/api/gallery?kind=video").then((r) => r.json() as Promise<{ items: MediaCard[] }>),
        fetch(`/api/trends?feed=topic&topic=knitting&category=${encodeURIComponent("Video tutorials")}`).then((r) => r.json() as Promise<FeedPage>),
        fetch(`/api/trends?feed=topic&topic=birds&category=${encodeURIComponent("Bird videos")}`).then((r) => r.json() as Promise<FeedPage>),
      ]);
      return { ours: [...songs.items, ...videos.items], discover: [...knit.items, ...birds.items].filter((t) => t.extra?.youtubeId).slice(0, 24) };
    },
    staleTime: 60_000,
  });

  // What just happened in the room ("Whitney started playing …"); messages live in the chat.
  const activity = events.filter((e) => e.kind === "system").slice(-3).reverse();
  const unread = pulse.data?.chat?.unread ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        {/* Who's here */}
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <div className="flex -space-x-2">
            {members.map((m) => (
              <Avatar key={m.id} name={m.displayName} url={m.avatarUrl} theme={m.theme} size={44} online={m.id === me.id ? true : (pState?.online ?? false)} />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{partner ? `${partner.displayName.split(" ")[0]} is ${status}` : "Just you for now"}</p>
            <p className="text-xs text-muted">{pState?.here ? "Everything you play, pause or skip happens for both of you." : "Start something — it'll be waiting in sync when they join."}</p>
          </div>
          {!pState?.here && (
            <button className="btn" onClick={() => startNudge(async () => void (await sendNudge("invite")))}>
              <IconHeadphones size={16} /> Invite {partner?.displayName.split(" ")[0]}
            </button>
          )}
        </div>

        {/* Stage */}
        <div data-world="us" className="relative mt-4 overflow-hidden rounded-3xl bg-black shadow-2xl">
          <div ref={stage} className={`relative ${isAudio || !key ? "aspect-[16/9] sm:aspect-[21/9]" : "aspect-video"}`}>
            {(isAudio || !key) && (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent via-rose-900 to-accent-2 p-6 text-center text-white">
                {key ? (
                  <div>
                    {ytId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={youtubeThumb(ytId, "mq")} alt="" className={`mx-auto size-28 rounded-2xl object-cover shadow-2xl ${state?.playing ? "animate-[spin_12s_linear_infinite] rounded-full" : ""}`} />
                    )}
                    {!ytId && <p className={`text-6xl ${state?.playing ? "animate-pulse" : ""}`}>♪</p>}
                    <p className="font-display mt-4 text-2xl font-semibold">{title}</p>
                    {state?.current?.artist && <p className="opacity-80">{state.current.artist}</p>}
                  </div>
                ) : (
                  <div>
                    <IconHeadphones size={46} strokeWidth={1.3} className="mx-auto opacity-90" />
                    <p className="font-lux mt-4 text-3xl font-medium">Pick something to enjoy together</p>
                    <p className="mt-1 text-sm opacity-80">A song from your gallery, a video, a knitting tutorial — or paste any YouTube link.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          {key && (
            <div className="flex flex-wrap items-center gap-3 bg-zinc-950 px-4 py-3 text-white">
              <button onClick={togglePlay} className="grid size-11 place-items-center rounded-full bg-white text-black transition active:scale-95" aria-label={state?.playing ? "Pause for both" : "Play for both"}>
                {state?.playing ? <IconPause size={18} /> : <IconPlay size={18} className="translate-x-px" />}
              </button>
              <span className="w-10 text-right text-xs tabular-nums text-white/70">{fmt(now)}</span>
              <input
                type="range"
                min={0}
                max={dur || 1}
                step={0.5}
                value={Math.min(now, dur || 1)}
                onChange={(e) => room.setScrub(Number(e.target.value))}
                onMouseUp={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
                className="min-w-24 flex-1 accent-pink-400"
                aria-label="Position (moves it for both of you)"
              />
              <span className="w-10 text-xs tabular-nums text-white/70">{fmt(dur)}</span>
              <button onClick={() => send({ type: "next" })} className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white" aria-label="Next in queue" title="Next">
                <IconNext size={18} />
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => room.setVolume(Number(e.target.value))} className="w-20 accent-pink-400" aria-label="My volume (only for me)" />
              <span className={`text-xs ${inSync ? "text-emerald-400" : "text-amber-300"}`}>{inSync ? (partnerHere ? `● In sync with ${partner?.displayName.split(" ")[0]}` : "● Ready") : "● Syncing…"}</span>
            </div>
          )}
        </div>

        {/* Reactions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {REACTIONS.map((r) => (
            <button key={r} onClick={() => send({ type: "react", emoji: r })} className="grid size-11 place-items-center rounded-full border border-line text-xl transition hover:scale-110 hover:bg-surface-2" aria-label={`Send ${r}`}>
              {r}
            </button>
          ))}
        </div>

        {activity.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-muted">
            {activity.map((e) => (
              <li key={e.id} suppressHydrationWarning>
                <span className="font-semibold text-ink">{nameOf(e.slug)}</span> {e.body} · {ago(e.createdAt)}
              </li>
            ))}
          </ul>
        )}

        {/* Messages: on phones, one tap to the full chat */}
        <Link href="/together/chat" className="tile mt-5 flex items-center gap-3 p-4 lg:hidden">
          <span className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold">
            <IconMessage size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Messages with {partner?.displayName.split(" ")[0]}</span>
            <span className="block text-xs text-muted">{unread ? `${unread} unread` : "Chat, call or video call"}</span>
          </span>
          {unread > 0 && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
        </Link>

        {/* Queue */}
        {state && state.queue.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold">Up next</p>
            <ul className="mt-2 space-y-2">
              {state.queue.map((q, i) => (
                <li key={q.id} className="card flex items-center gap-3 p-2 pr-3 text-sm">
                  <span className="w-5 text-center text-muted">{i + 1}</span>
                  {q.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.thumbUrl} alt="" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-lg bg-accent-soft">♪</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{q.title ?? q.caption ?? (q.kind === "video" ? "Video" : "Song")}</span>
                  <button className="text-xs text-muted hover:text-ink" onClick={() => send({ type: "load", mediaId: q.id, play: true })}>
                    Play now
                  </button>
                  <button className="text-xs text-muted hover:text-red-600" onClick={() => send({ type: "dequeue", mediaId: q.id })} aria-label="Remove from queue">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Library */}
        <div className="mt-8">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const id = youtubeIdFrom(link);
              if (!id) return;
              setLink("");
              send({ type: "load", youtubeId: id, play: true });
            }}
          >
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste any YouTube link to play it together now" className="field" aria-label="YouTube link" />
            <button className="btn shrink-0">Play</button>
          </form>

          <p className="mt-6 font-semibold">From our gallery</p>
          {lib.data && lib.data.ours.length === 0 && <p className="mt-2 text-sm text-muted">Add songs and videos in the Gallery and they&apos;ll show up here.</p>}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {lib.data?.ours.map((m) => (
              <div key={m.id} className="card overflow-hidden">
                <div className="relative aspect-video bg-surface-2">
                  {m.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-3xl">♪</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{m.title ?? m.caption ?? (m.kind === "video" ? "Video" : "Song")}</p>
                  <div className="mt-1 flex gap-2 text-xs">
                    <button className="font-semibold text-accent" onClick={() => send({ type: "load", mediaId: m.id, play: true })}>
                      ▶ Play
                    </button>
                    <button className="text-muted hover:text-ink" onClick={() => send({ type: "queue", mediaId: m.id })}>
                      + Queue
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {lib.isPending && Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-video animate-pulse rounded-2xl bg-surface-2" />)}
          </div>

          {!!lib.data?.discover.length && (
            <>
              <p className="mt-6 font-semibold">Watch together: knitting tutorials & bird videos</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {lib.data.discover.map((t) => (
                  <button key={t.id} className="card overflow-hidden text-left transition hover:border-accent" onClick={() => send({ type: "load", youtubeId: t.extra!.youtubeId!, title: t.title, play: true })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={youtubeThumb(t.extra!.youtubeId!, "mq")} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                    <p className="line-clamp-2 p-2 text-xs font-semibold">{t.title}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat: the same conversation as Messages, beside the stage on large screens */}
      <aside className="hidden h-[calc(100dvh-7rem)] min-h-[34rem] lg:sticky lg:top-20 lg:block">
        <ChatView variant="panel" />
      </aside>
    </div>
  );
}
