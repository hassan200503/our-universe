"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { RoomAction, RoomPayload } from "@/lib/together/room";
import { youtubeThumb } from "@/lib/media/youtube";
import { useCall } from "@/components/call/call-provider";
import { roomLive } from "@/lib/ui/room-live";
import { IconPause, IconPlay, IconX } from "@/components/icons";
import { FilePlayer, type PlayerHandle, Prefetch, warmYouTube, YouTubePlayer } from "./player";

type State = NonNullable<RoomPayload["state"]>;
type Ev = RoomPayload["events"][number];
type Floater = { id: number; emoji: string; x: number };

type RoomApi = {
  /** The room is live on this device (opened this visit, not stopped). */
  active: boolean;
  state: State | undefined;
  events: Ev[];
  partners: RoomPayload["partners"];
  key: string | null;
  ytId: string | null;
  title: string | null;
  isAudio: boolean;
  now: number;
  dur: number;
  inSync: boolean;
  needTap: boolean;
  volume: number;
  floaters: Floater[];
  setVolume: (v: number) => void;
  setScrub: (t: number) => void;
  removeFloater: (id: number) => void;
  send: (a: RoomAction) => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (t: number) => Promise<void>;
  join: () => Promise<void>;
  /** The room page hands over its first server read, and the box the picture should fill. */
  activate: (initial: RoomPayload) => void;
  stage: (el: HTMLDivElement | null) => void;
};

const RoomContext = createContext<RoomApi | null>(null);
export function useRoom(): RoomApi | null {
  return useContext(RoomContext);
}

const keyOf = (s: State | undefined) => s?.current?.id ?? s?.youtube?.id ?? null;
const titleOf = (s: State | undefined) => s?.current?.title ?? s?.youtube?.title ?? (s?.current ? (s.current.kind === "song" ? "A song" : "A video") : null);

/**
 * Listening and watching together, for the whole site. The player lives in the
 * root layout, so opening Messages, answering a call or wandering anywhere else
 * never stops the music: outside the room it shrinks to a mini-player. The room
 * page only draws the controls and marks where the picture goes.
 *
 * Keeping two phones in step: the server holds {playing, position, updatedAt};
 * each phone estimates the server's clock from its fastest recent round trips,
 * works out where the track should be now, and closes small gaps by playing a
 * touch faster or slower. It only jumps for big gaps, never while the player is
 * still buffering (that would restart the wait), and backs off if jumps keep
 * being needed on a slow connection.
 */
export function RoomProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const inRoom = path === "/together";
  const call = useCall();
  const phase = call?.snap.phase;
  const inCall = phase === "connecting" || phase === "connected" || phase === "reconnecting";
  // Phones have the tab bar at the bottom; wider screens don't.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const [active, setActive] = useState(false);
  const [state, setState] = useState<State | undefined>();
  const [events, setEvents] = useState<Ev[]>([]);
  const [partners, setPartners] = useState<RoomPayload["partners"]>([]);
  const [tapKey, setTapKey] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(1);
  const [inSync, setInSync] = useState(true);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const version = useRef(-1);
  const after = useRef(0);
  const shown = useRef(new Set<number>());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const player = useRef<PlayerHandle>(null);
  const readyFor = useRef<string | null>(null);
  const endedSent = useRef<string | null>(null);
  const blocked = useRef(false);

  // ── The server's clock, from the fastest of the last few round trips (the least delayed estimate).
  const offset = useRef(0);
  const samples = useRef<{ rtt: number; offset: number }[]>([]);
  const clock = useCallback((serverNow: string, t0: number) => {
    const t1 = Date.now();
    const sample = { rtt: t1 - t0, offset: Date.parse(serverNow) - (t0 + t1) / 2 };
    samples.current = [...samples.current, sample].slice(-12);
    offset.current = samples.current.reduce((a, b) => (b.rtt < a.rtt ? b : a)).offset;
  }, []);

  const absorb = useCallback(
    (p: RoomPayload, t0: number | null) => {
      if (t0 !== null) clock(p.serverNow, t0);
      // Replies can arrive out of order on a mobile network: never let an older state undo a newer one.
      if (p.state && p.version >= version.current) {
        version.current = p.version;
        setState(p.state);
      }
      setPartners(p.partners);
      const fresh = p.events.filter((e) => !shown.current.has(e.id));
      if (fresh.length) {
        fresh.forEach((e) => shown.current.add(e.id));
        after.current = Math.max(after.current, ...fresh.map((e) => e.id));
        setEvents((es) => [...es, ...fresh].slice(-80));
        const reacts = fresh.filter((e) => e.kind === "react" && Date.now() - Date.parse(e.createdAt) < 15_000);
        if (reacts.length) setFloaters((f) => [...f, ...reacts.map((e) => ({ id: e.id, emoji: e.body, x: 10 + Math.random() * 80 }))].slice(-20));
      }
    },
    [clock],
  );

  const activate = useCallback(
    (initial: RoomPayload) => {
      if (version.current < 0) {
        // First visit: the page's own read (made on the server) sets the clock and the history.
        offset.current = Date.parse(initial.serverNow) - Date.now();
        initial.events.forEach((e) => shown.current.add(e.id));
        after.current = initial.events.at(-1)?.id ?? 0;
        setEvents(initial.events);
      }
      absorb({ ...initial, events: [] }, null);
      setActive(true);
      warmYouTube();
    },
    [absorb],
  );

  useEffect(() => {
    roomLive.current = active;
  }, [active]);

  const inRoomRef = useRef(inRoom);
  useEffect(() => {
    inRoomRef.current = inRoom;
  }, [inRoom]);

  // ── Polling: ~1 s when you're both in the room; in the background elsewhere only while something plays.
  const partnerHere = partners.some((p) => p.here);
  const playing = !!state?.playing;
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible" || stateRef.current?.playing) {
        const t0 = Date.now();
        try {
          const res = await fetch(`/api/room?v=${version.current}&after=${after.current}${inRoom ? "" : "&away=1"}`, { cache: "no-store" });
          if (res.ok) absorb(await res.json(), t0);
        } catch {
          /* transient; keep going */
        }
      }
      if (!stop) timer = setTimeout(tick, inRoom ? (partnerHere ? 1000 : 2500) : playing ? 1500 : 5000);
    };
    timer = setTimeout(tick, 300);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [active, absorb, partnerHere, inRoom, playing]);

  const send = useCallback(
    async (a: RoomAction) => {
      // Choosing something to play is a tap: this device may play sound again.
      if (a.type === "load" || a.type === "play" || a.type === "next") {
        blocked.current = false;
        setTapKey(null);
      }
      if (a.type === "load") endedSent.current = null;
      const t0 = Date.now();
      try {
        const res = await fetch(`/api/room?after=${after.current}${inRoomRef.current ? "" : "&away=1"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
        if (res.ok) absorb(await res.json(), t0);
      } catch {
        /* the next poll brings the truth */
      }
    },
    [absorb],
  );

  const expected = useCallback(() => {
    const s = stateRef.current;
    if (!s) return 0;
    if (!s.playing) return s.position;
    return s.position + (Date.now() + offset.current - Date.parse(s.updatedAt)) / 1000;
  }, []);

  const key = keyOf(state);
  useEffect(() => {
    blocked.current = false;
  }, [key]);

  // ── Keep my player where the shared state says it should be.
  const busy = useRef(false);
  const lastSeek = useRef(0);
  const seekGap = useRef(2500);
  const settledSince = useRef(0);
  const overCount = useRef(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(async () => {
      // One step at a time: a slow play() must not overlap the next check.
      if (busy.current) return;
      busy.current = true;
      try {
        const s = stateRef.current;
        const p = player.current;
        const current = keyOf(s);
        if (!s || !p || !current || readyFor.current !== current) return;
        const want = expected();
        const d = p.duration();
        setNow(p.time());
        setDur(d);
        // The shared clock says this track is over (e.g. it finished while I was away): move everyone on.
        if (s.playing && d > 0 && want >= d - 0.25) {
          if (p.playing()) p.pause();
          if (endedSent.current !== current) {
            endedSent.current = current;
            void send({ type: "ended", key: current, version: version.current });
          }
          return;
        }
        if (!s.playing) {
          if (p.playing()) p.pause();
          if (Math.abs(p.time() - want) > 0.35 && Date.now() - lastSeek.current > 1500) {
            p.seek(Math.max(0, want));
            lastSeek.current = Date.now();
          }
          settledSince.current = 0;
          setInSync(true);
          return;
        }
        if (!p.playing()) {
          if (blocked.current) return;
          // Start from where the other phone is right now, not from where this one stopped.
          if (Math.abs(p.time() - want) > 0.25 && (!d || want < d - 0.5)) {
            p.seek(Math.max(0, want));
            lastSeek.current = Date.now();
          }
          settledSince.current = 0;
          if (!(await p.play())) {
            blocked.current = true;
            setTapKey(keyOf(stateRef.current));
          }
          return;
        }
        // Buffering: its clock is frozen, and jumping now would only restart the wait.
        if (p.buffering()) {
          settledSince.current = 0;
          return;
        }
        settledSince.current ||= Date.now();
        if (Date.now() - settledSince.current < 1200) return;
        const drift = p.time() - want;
        const hard = p.setRate ? 1 : 1.6;
        overCount.current = Math.abs(drift) > hard ? overCount.current + 1 : 0;
        // Jump only where it won't stall: to audio already downloaded, or when far out (a slow line can't catch up otherwise).
        const canJump = !p.has || p.has(want) || Math.abs(drift) > 8;
        if (overCount.current >= 2 && canJump && (!d || want < d - 1) && Date.now() - lastSeek.current > (p.has?.(want) ? 1500 : seekGap.current)) {
          lastSeek.current = Date.now();
          // Needing to jump again soon means a slow connection: wait longer before the next jump.
          seekGap.current = Math.min(seekGap.current * 2, 20_000);
          overCount.current = 0;
          settledSince.current = 0;
          p.setRate?.(1);
          // A stream needs a moment to resume after a jump; land a little ahead so it resumes in step.
          p.seek(Math.max(0, want + (p.setRate ? 0.05 : 0.4)));
        } else if (p.setRate) {
          // Gaps close by playing a little faster or slower (pitch is kept), with no audible jump:
          // up to 5% for small gaps, up to 10% while catching up after a stall.
          const cap = Math.abs(drift) > hard ? 0.1 : 0.05;
          p.setRate(Math.abs(drift) > 0.06 ? 1 - Math.max(-cap, Math.min(cap, drift * 0.1)) : 1);
        }
        if (Math.abs(drift) < 0.3 && Date.now() - lastSeek.current > 30_000) seekGap.current = 2500;
        setInSync(Math.abs(drift) <= hard + 0.25);
      } finally {
        busy.current = false;
      }
    }, 500);
    return () => clearInterval(id);
  }, [active, expected, send]);

  // During a call the music steps back so you can hear each other.
  const heard = inCall ? volume * 0.2 : volume;
  useEffect(() => {
    player.current?.setVolume(heard);
  }, [heard, key]);

  const optimistic = (patch: Partial<State>) => setState((s) => (s ? { ...s, ...patch, updatedAt: new Date(Date.now() + offset.current).toISOString() } : s));
  const togglePlay = async () => {
    const p = player.current;
    const pos = p?.time() ?? expected();
    const at = Date.now() + offset.current;
    if (stateRef.current?.playing) {
      p?.pause();
      optimistic({ playing: false, position: pos });
      await send({ type: "pause", position: pos, at });
    } else {
      blocked.current = false;
      setTapKey(null);
      settledSince.current = 0;
      await p?.play();
      optimistic({ playing: true, position: pos });
      await send({ type: "play", position: pos, at });
    }
  };
  const seekTo = async (t: number) => {
    player.current?.seek(t);
    lastSeek.current = Date.now();
    settledSince.current = 0;
    optimistic({ position: t });
    await send({ type: "seek", position: t, at: Date.now() + offset.current });
  };
  const join = async () => {
    blocked.current = false;
    const ok = await player.current?.play();
    if (ok) {
      setTapKey(null);
      player.current?.seek(expected());
      settledSince.current = 0;
    }
  };

  // ── Where the picture goes: over the room page's stage, or a mini-player elsewhere.
  useEffect(() => {
    if (!stageEl || !inRoom) return;
    let last = "";
    const measure = () => {
      const r = stageEl.getBoundingClientRect();
      const next = { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
      const sig = `${next.top}|${next.left}|${next.width}|${next.height}`;
      if (sig !== last) {
        last = sig;
        setBox(next);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stageEl);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    const id = setInterval(measure, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearInterval(id);
    };
  }, [stageEl, inRoom]);

  const ytId = state?.current?.youtubeId ?? state?.youtube?.id ?? null;
  const fileSrc = !ytId && state?.current?.url ? state.current.url : null;
  const isAudio = state?.current?.kind === "song";
  const title = titleOf(state);
  const needTap = tapKey !== null && tapKey === key;
  const nextUp = state?.queue[0];
  const onStage = inRoom && !!stageEl && !!box;
  const showMini = active && !!key && !inRoom;
  const onChat = path.startsWith("/together/chat");

  // Mini-player corner: under the header on the Messages page (the message box is at the bottom), else above the tab bar.
  const base = wide ? "1.25rem" : "calc(env(safe-area-inset-bottom) + 6.2rem)";
  const videoW = "min(15rem, 46vw)";
  const videoH = `(${videoW} * 9 / 16)`;
  const top = "calc(env(safe-area-inset-top) + 4.25rem)";
  const hostStyle: React.CSSProperties = onStage
    ? { position: "absolute", top: box!.top, left: box!.left, width: box!.width, height: box!.height, zIndex: 20 }
    : showMini && !isAudio
      ? { position: "fixed", right: 12, width: videoW, aspectRatio: "16 / 9", zIndex: 45, ...(onChat ? { top } : { bottom: `calc(${base} + 3rem)` }) }
      : { position: "fixed", width: 1, height: 1, left: 0, bottom: 0, opacity: 0, pointerEvents: "none" };
  const barStyle: React.CSSProperties = onChat ? { top: isAudio ? top : `calc(${top} + ${videoH} + 0.5rem)`, right: 12 } : { bottom: base, right: 12 };

  const api: RoomApi = {
    active,
    state,
    events,
    partners,
    key,
    ytId,
    title,
    isAudio,
    now,
    dur,
    inSync,
    needTap,
    volume,
    floaters,
    setVolume,
    setScrub: setNow,
    removeFloater: (id) => setFloaters((x) => x.filter((y) => y.id !== id)),
    send,
    togglePlay,
    seekTo,
    join,
    activate,
    stage: setStageEl,
  };

  return (
    <RoomContext.Provider value={api}>
      {children}
      {active && key && (
        <div style={hostStyle} className={`pointer-events-none overflow-hidden ${showMini && !isAudio ? "rounded-2xl bg-black shadow-2xl ring-1 ring-white/10" : ""}`} aria-hidden={!onStage && !showMini}>
          {ytId && <YouTubePlayer ref={player} videoId={ytId} audioOnly={isAudio} playing={state?.playing} startAt={expected} onReady={() => (readyFor.current = key)} onEnded={() => void send({ type: "ended", key, version: version.current })} />}
          {fileSrc && <FilePlayer key={key} ref={player} src={fileSrc} kind={isAudio ? "song" : "video"} poster={state?.current?.thumbUrl} onReady={() => (readyFor.current = key)} onEnded={() => void send({ type: "ended", key, version: version.current })} />}
          {nextUp?.url && !nextUp.youtubeId && nextUp.id !== key && <Prefetch key={nextUp.id} src={nextUp.url} kind={nextUp.kind === "song" ? "song" : "video"} />}
          {onStage &&
            floaters.map((f) => (
              <span
                key={f.id}
                className="absolute bottom-4 text-4xl motion-reduce:hidden"
                style={{ left: `${f.x}%`, animation: "float-up 3s ease-out forwards" }}
                onAnimationEnd={() => setFloaters((x) => x.filter((y) => y.id !== f.id))}
              >
                {f.emoji}
              </span>
            ))}
          {needTap && (onStage || showMini) && (
            <button onClick={join} className="pointer-events-auto absolute inset-0 z-10 grid place-items-center bg-black/60 text-white backdrop-blur-sm">
              <span className={`rounded-full bg-white font-semibold text-black shadow-2xl ${onStage ? "px-6 py-3 text-lg" : "px-3 py-1.5 text-xs"}`}>▶ Tap to join</span>
            </button>
          )}
          {showMini && !isAudio && (
            <Link href="/together" className="pointer-events-auto absolute inset-0" aria-label={`Back to the room: ${title ?? "video"}`} />
          )}
        </div>
      )}
      {showMini && (
        <MiniBar
          title={title}
          art={ytId ? youtubeThumb(ytId, "mq") : (state?.current?.thumbUrl ?? null)}
          playing={!!state?.playing}
          needTap={needTap}
          style={barStyle}
          onToggle={() => void (needTap ? join() : togglePlay())}
          onStop={() => {
            player.current?.pause();
            setActive(false);
          }}
        />
      )}
    </RoomContext.Provider>
  );
}

/** Outside the room: what's playing, play/pause for both, back to the room, or stop on this device. */
function MiniBar({ title, art, playing, needTap, style, onToggle, onStop }: { title: string | null; art: string | null; playing: boolean; needTap: boolean; style: React.CSSProperties; onToggle: () => void; onStop: () => void }) {
  return (
    <div role="region" aria-label="Playing together" className="glass fixed z-[46] flex max-w-[min(20rem,calc(100vw-24px))] items-center gap-2 rounded-full border border-line py-1 pl-1 pr-1.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.5)]" style={style}>
      <Link href="/together" className="flex min-w-0 items-center gap-2" aria-label="Back to the room">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className={`size-8 shrink-0 rounded-full object-cover ${playing ? "animate-[spin_12s_linear_infinite]" : ""}`} />
        ) : (
          <span className={`grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm text-accent-ink ${playing ? "animate-pulse" : ""}`}>♪</span>
        )}
        <span className="min-w-0 truncate text-xs font-semibold">{needTap ? "Tap ▶ to join" : (title ?? "Playing together")}</span>
      </Link>
      <button onClick={onToggle} className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-bg" aria-label={needTap ? "Join" : playing ? "Pause for both" : "Play for both"}>
        {playing && !needTap ? <IconPause size={14} /> : <IconPlay size={14} className="translate-x-px" />}
      </button>
      <button onClick={onStop} className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:text-ink" aria-label="Stop on this device" title="Stop on this device">
        <IconX size={14} />
      </button>
    </div>
  );
}
