"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/** The small surface the room needs from any player. */
export type PlayerHandle = {
  play: () => Promise<boolean>;
  pause: () => void;
  seek: (t: number) => void;
  time: () => number;
  duration: () => number;
  playing: () => boolean;
  setVolume: (v: number) => void;
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

export const YouTubePlayer = forwardRef<PlayerHandle, { videoId: string; onEnded: () => void; onReady: () => void; audioOnly?: boolean }>(function YouTubePlayer({ videoId, onEnded, onReady, audioOnly }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const ended = useRef(onEnded);
  ended.current = onEnded;
  const readyCb = useRef(onReady);
  readyCb.current = onReady;
  const current = useRef(videoId);

  useEffect(() => {
    let cancelled = false;
    loadYouTube().then((YT) => {
      if (cancelled || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, iv_load_policy: 3, fs: 0 },
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
    // The player is created once; later videos are swapped in with cueVideoById.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current.current === videoId) return;
    current.current = videoId;
    if (ready.current) player.current?.cueVideoById({ videoId });
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    play: async () => {
      if (!ready.current || !player.current) return false;
      player.current.playVideo();
      // Autoplay may be blocked; report whether playback actually started.
      await new Promise((r) => setTimeout(r, 600));
      const s = player.current?.getPlayerState();
      return s === 1 || s === 3;
    },
    pause: () => player.current?.pauseVideo(),
    seek: (t) => player.current?.seekTo(t, true),
    time: () => (ready.current ? (player.current?.getCurrentTime() ?? 0) : 0),
    duration: () => (ready.current ? (player.current?.getDuration() ?? 0) : 0),
    playing: () => {
      const s = player.current?.getPlayerState();
      return s === 1 || s === 3;
    },
    setVolume: (v) => player.current?.setVolume(Math.round(v * 100)),
  }));

  return <div ref={host} className={`[&>iframe]:size-full ${audioOnly ? "pointer-events-none absolute size-px opacity-0" : "pointer-events-none absolute inset-0"}`} />;
});

// ─── Uploaded audio / video ───────────────────────────────────────────────

export const FilePlayer = forwardRef<PlayerHandle, { src: string; kind: "video" | "song"; poster?: string | null; onEnded: () => void; onReady: () => void }>(function FilePlayer({ src, kind, poster, onEnded, onReady }, ref) {
  const el = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [, force] = useState(0);
  useImperativeHandle(ref, () => ({
    play: async () => {
      try {
        await el.current?.play();
        return true;
      } catch {
        return false;
      }
    },
    pause: () => el.current?.pause(),
    seek: (t) => {
      if (el.current) el.current.currentTime = t;
    },
    time: () => el.current?.currentTime ?? 0,
    duration: () => (el.current && Number.isFinite(el.current.duration) ? el.current.duration : 0),
    playing: () => !!el.current && !el.current.paused,
    setVolume: (v) => {
      if (el.current) el.current.volume = v;
    },
  }));
  const common = {
    ref: el,
    src,
    preload: "auto" as const,
    playsInline: true,
    onEnded,
    onLoadedMetadata: () => {
      onReady();
      force((x) => x + 1);
    },
  };
  return kind === "video" ? <video {...common} poster={poster ?? undefined} className="absolute inset-0 size-full bg-black object-contain" /> : <audio {...common} className="hidden" />;
});
