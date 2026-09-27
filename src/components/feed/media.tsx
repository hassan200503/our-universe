"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { proxied, srcSet } from "@/lib/ui/img";

/**
 * A fast, resilient image: small WebP from the image CDN first, the original if
 * the CDN can't fetch it, and `fallback` if neither works. Space is reserved by
 * the parent's aspect ratio, so nothing jumps while it loads.
 */
export function SmartImage({ src, alt, className = "", sizes = "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw", fallback, priority = false }: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  fallback?: React.ReactNode;
  priority?: boolean;
}) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [loaded, setLoaded] = useState(false);
  if (stage === 2) return <>{fallback ?? null}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote images from many hosts, resized by the image CDN
    <img
      src={stage === 0 ? proxied(src, 640) : src}
      srcSet={stage === 0 ? srcSet(src) : undefined}
      sizes={sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
      className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}

/** YouTube, loaded only when tapped: a thumbnail costs ~30 KB, a player ~1 MB. */
export function VideoPlayer({ youtubeId, title, thumb }: { youtubeId: string; title: string; thumb: string }) {
  const [playing, setPlaying] = useState(false);
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  async function together() {
    setJoining(true);
    const res = await fetch("/api/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "load", youtubeId, title, play: true }) });
    if (res.ok) router.push("/together");
    else setJoining(false);
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-t-[17px] bg-black">
      {!playing && (
        <button type="button" onClick={together} disabled={joining} className="absolute right-2 top-2 z-10 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/80">
          {joining ? "Opening…" : "🎧 Watch together"}
        </button>
      )}
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label={`Play video: ${title}`}>
          <SmartImage src={thumb} alt="" className="size-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl text-black shadow-xl transition group-hover:scale-110">
            ▶
          </span>
          <span className="absolute bottom-2 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[0.7rem] font-semibold text-white">Video · with sound</span>
        </button>
      )}
    </div>
  );
}

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** One sound at a time across the whole page. */
const CHANNEL = "ou:audio-play";

export function SoundPlayer({ id, src, label, credit }: { id: string; src: string; label: string; credit?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const other = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) ref.current?.pause();
    };
    window.addEventListener(CHANNEL, other);
    return () => window.removeEventListener(CHANNEL, other);
  }, [id]);

  async function toggle() {
    const a = ref.current;
    if (!a) return;
    if (!a.paused) return a.pause();
    window.dispatchEvent(new CustomEvent(CHANNEL, { detail: id }));
    setState("loading");
    try {
      await a.play();
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-accent-soft/70 p-2.5">
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setD(e.currentTarget.duration)}
        onWaiting={() => setState("loading")}
        onPlaying={() => setState("idle")}
        onError={() => setState("error")}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-lg text-accent-ink shadow transition hover:scale-105"
      >
        {state === "loading" ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : playing ? "❚❚" : "▶"}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          🎵 {label}
          {state === "error" && <span className="ml-1 font-normal text-red-600"> · couldn&apos;t load, try again</span>}
        </p>
        <input
          type="range"
          min={0}
          max={d || 1}
          step={0.1}
          value={t}
          aria-label="Position"
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
          }}
          className="mt-1 h-1 w-full cursor-pointer accent-[var(--accent)]"
        />
        <p className="flex justify-between text-[0.65rem] text-muted">
          <span>{fmt(t)}</span>
          <span className="truncate pl-2">{credit}</span>
          <span>{fmt(d)}</span>
        </p>
      </div>
    </div>
  );
}
