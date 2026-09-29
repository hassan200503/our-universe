"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { preconnect } from "react-dom";

/** The small surface the room needs from any player. */
export type PlayerHandle = {
  play: () => Promise<boolean>;
  pause: () => void;
  seek: (t: number) => void;
  time: () => number;
  duration: () => number;
  playing: () => boolean;
  /** Waiting for data (network or a seek): its clock isn't moving, so it can't be judged for drift. */
  buffering: () => boolean;
  /** Whether second `t` is already downloaded, so jumping there won't stall (files only). */
  has?: (t: number) => boolean;
  setVolume: (v: number) => void;
  /** Fine speed control for keeping two phones in step (files only; YouTube steps are too coarse). */
  setRate?: (r: number) => void;
};

// ─── YouTube IFrame API ────────────────────────────────────────────────────

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume(v: number): void;
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  cueVideoById(o: { videoId: string; startSeconds?: number }): void;
  destroy(): void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { PLAYING: number; ENDED: number; BUFFERING: number } };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytLoading: Promise<YTNamespace> | null = null;

/** Starts loading YouTube's player as soon as the room opens, so the first video starts without a wait. */
export function warmYouTube() {
  preconnect("https://www.youtube-nocookie.com");
  preconnect("https://www.youtube.com");
  preconnect("https://i.ytimg.com");
  preconnect("https://www.google.com");
  void loadYouTube().catch(() => {});
}

function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytLoading ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytLoading;
}

export const YouTubePlayer = forwardRef<PlayerHandle, { videoId: string; onEnded: () => void; onReady: () => void; audioOnly?: boolean; startAt?: () => number; playing?: boolean }>(function YouTubePlayer(
  { videoId, onEnded, onReady, audioOnly, startAt, playing },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const ended = useRef(onEnded);
  const readyCb = useRef(onReady);
  const current = useRef(videoId);
  const shouldPlay = useRef(playing);
  const startFrom = useRef(startAt);
  useEffect(() => {
    ended.current = onEnded;
    readyCb.current = onReady;
    shouldPlay.current = playing;
    startFrom.current = startAt;
  });

  useEffect(() => {
    let cancelled = false;
    loadYouTube().then((YT) => {
      if (cancelled || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        // The latest video, in case it changed while YouTube's script was still loading.
        videoId: current.current,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, iv_load_policy: 3, fs: 0, start: Math.floor(startFrom.current?.() ?? 0) },
        events: {
          onReady: () => {
            ready.current = true;
            readyCb.current();
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.ENDED) ended.current();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      ready.current = false;
    };
    // The player is created once; later videos are swapped in (see below).
  }, []);

  useEffect(() => {
    if (current.current === videoId) return;
    current.current = videoId;
    if (!ready.current) return;
    // Already playing for both of you: start loading at the right second straight away.
    const startSeconds = Math.max(0, startFrom.current?.() ?? 0);
    if (shouldPlay.current) player.current?.loadVideoById({ videoId, startSeconds });
    else player.current?.cueVideoById({ videoId, startSeconds });
    // The same player now holds the new video: tell the room it can steer this one.
    readyCb.current();
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    play: async () => {
      if (!ready.current || !player.current) return false;
      player.current.playVideo();
      // Autoplay may be blocked; report whether playback actually started. A slow network can
      // take a while to reach "buffering", so only a player still idle after ~3 s counts as blocked.
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const s = player.current?.getPlayerState();
        if (s === 1 || s === 3) return true;
      }
      return false;
    },
    pause: () => player.current?.pauseVideo(),
    seek: (t) => player.current?.seekTo(t, true),
    time: () => (ready.current ? (player.current?.getCurrentTime() ?? 0) : 0),
    duration: () => (ready.current ? (player.current?.getDuration() ?? 0) : 0),
    playing: () => {
      const s = player.current?.getPlayerState();
      return s === 1 || s === 3;
    },
    buffering: () => player.current?.getPlayerState() === 3,
    setVolume: (v) => player.current?.setVolume(Math.round(v * 100)),
  }));

  return <div ref={host} className={`[&>iframe]:size-full ${audioOnly ? "pointer-events-none absolute size-px opacity-0" : "pointer-events-none absolute inset-0"}`} />;
});

// ─── Uploaded audio / video ───────────────────────────────────────────────

export const FilePlayer = forwardRef<PlayerHandle, { src: string; kind: "video" | "song"; poster?: string | null; onEnded: () => void; onReady: () => void }>(function FilePlayer({ src, kind, poster, onEnded, onReady }, ref) {
  const el = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [, force] = useState(0);
  // Signed links are re-issued as the room refreshes; keep playing from the one we started with,
  // and only switch (at the same second) if it expires.
  const [active, setActive] = useState(src);
  const resumeAt = useRef<number | null>(null);
  const readyCb = useRef(onReady);
  useEffect(() => {
    readyCb.current = onReady;
  });
  // The page is rendered on the server, so a cached file can finish loading before React is
  // listening: if it already has its metadata when we take over, it's ready now.
  useEffect(() => {
    if ((el.current?.readyState ?? 0) >= 1) {
      readyCb.current();
      force((x) => x + 1);
    }
  }, []);
  try {
    preconnect(new URL(src, "https://x").origin);
  } catch {
    /* relative URL */
  }
  useImperativeHandle(ref, () => ({
    play: async () => {
      try {
        await el.current?.play();
        return true;
      } catch (e) {
        // Only the browser's autoplay rule needs a tap; a start interrupted by a pause or a new source doesn't.
        return (e as { name?: string })?.name !== "NotAllowedError";
      }
    },
    pause: () => el.current?.pause(),
    seek: (t) => {
      if (el.current) el.current.currentTime = t;
    },
    time: () => el.current?.currentTime ?? 0,
    duration: () => (el.current && Number.isFinite(el.current.duration) ? el.current.duration : 0),
    playing: () => !!el.current && !el.current.paused,
    buffering: () => !!el.current && (el.current.seeking || el.current.readyState < 3),
    has: (t) => {
      const b = el.current?.buffered;
      if (!b) return false;
      for (let i = 0; i < b.length; i++) if (t >= b.start(i) && t + 2 <= b.end(i)) return true;
      return false;
    },
    setVolume: (v) => {
      if (el.current) el.current.volume = v;
    },
    setRate: (r) => {
      if (el.current && Math.abs(el.current.playbackRate - r) > 0.001) el.current.playbackRate = r;
    },
  }));
  const common = {
    ref: el,
    src: active,
    preload: "auto" as const,
    playsInline: true,
    onEnded,
    onError: () => {
      if (src === active) return;
      resumeAt.current = el.current?.currentTime ?? 0;
      setActive(src);
    },
    onLoadedMetadata: () => {
      if (resumeAt.current !== null && el.current) {
        el.current.currentTime = resumeAt.current;
        resumeAt.current = null;
      }
      readyCb.current();
      force((x) => x + 1);
    },
  };
  return kind === "video" ? <video {...common} poster={poster ?? undefined} className="absolute inset-0 size-full bg-black object-contain" /> : <audio {...common} className="hidden" />;
});

/** Quietly buffers the next song or video in the queue, so it starts at once when its turn comes. */
export function Prefetch({ src, kind }: { src: string; kind: "video" | "song" }) {
  return kind === "song" ? <audio src={src} preload="auto" muted className="hidden" aria-hidden /> : <video src={src} preload="metadata" muted playsInline className="hidden" aria-hidden />;
}
