"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconFlip, IconMic, IconMicOff, IconMinimize, IconPhone, IconPhoneOff, IconSignal, IconSpeaker, IconVideo, IconVideoOff } from "@/components/icons";
import { useMembers } from "@/components/me-context";
import { duration } from "@/components/chat/format";
import { useCall } from "./call-provider";

function useTicker(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

function StreamVideo({ stream, mirrored, className, muted = true }: { stream: MediaStream | null; mirrored?: boolean; className?: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} style={mirrored ? { transform: "scaleX(-1)" } : undefined} />;
}

/** A round call control. `on` shows the pressed (e.g. muted) state. */
function Control({ label, onClick, children, on = false, tone = "glass", size = 58 }: { label: string; onClick: () => void; children: React.ReactNode; on?: boolean; tone?: "glass" | "danger" | "accept"; size?: number }) {
  const look =
    tone === "danger"
      ? "bg-[#e5484d] text-white shadow-[0_12px_30px_-10px_rgb(229_72_77/0.8)] hover:bg-[#d93d42]"
      : tone === "accept"
        ? "bg-[#30a46c] text-white shadow-[0_12px_30px_-10px_rgb(48_164_108/0.8)] hover:bg-[#2b9a64]"
        : on
          ? "bg-white text-[#15121a]"
          : "bg-white/12 text-white ring-1 ring-white/15 backdrop-blur-xl hover:bg-white/20";
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={onClick} aria-label={label} aria-pressed={tone === "glass" ? on : undefined} className={`grid place-items-center rounded-full transition active:scale-95 ${look}`} style={{ width: size, height: size }}>
        {children}
      </button>
      <span className="text-[0.7rem] font-medium tracking-wide text-white/70">{label}</span>
    </div>
  );
}

/** The local camera preview: drag it to any corner. */
function Pip({ stream, mirrored }: { stream: MediaStream | null; mirrored: boolean }) {
  const [corner, setCorner] = useState<"tr" | "tl" | "br" | "bl">("tr");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pos = { tr: "right-4 top-20", tl: "left-4 top-20", br: "right-4 bottom-40", bl: "left-4 bottom-40" }[corner];
  return (
    <div
      className={`absolute z-20 h-44 w-28 touch-none overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20 sm:h-56 sm:w-40 ${drag ? "" : "transition-all duration-300"} ${pos}`}
      style={drag ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* the pointer was already released */
        }
      }}
      onPointerMove={(e) => start.current && setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })}
      onPointerUp={(e) => {
        start.current = null;
        setDrag(null);
        setCorner(`${e.clientY < window.innerHeight / 2 ? "t" : "b"}${e.clientX < window.innerWidth / 2 ? "l" : "r"}` as typeof corner);
      }}
    >
      <StreamVideo stream={stream} mirrored={mirrored} className="size-full object-cover" />
    </div>
  );
}

/** Full-screen call, a floating pill when minimised, and the incoming-call screen. */
export function CallScreen() {
  const api = useCall();
  const members = useMembers();
  const snap = api?.snap;
  const now = useTicker(snap?.phase === "connected" || snap?.phase === "reconnecting");
  const [sinks, setSinks] = useState<MediaDeviceInfo[]>([]);
  const [sink, setSink] = useState(0);

  useEffect(() => {
    // Desktop browsers can switch the output (speakers vs headphones); phones use their own controls.
    if (snap?.phase !== "connected" || typeof HTMLMediaElement === "undefined" || !("setSinkId" in HTMLMediaElement.prototype)) return;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setSinks(d.filter((x) => x.kind === "audiooutput" && x.deviceId !== "default" && x.deviceId !== "communications")))
      .catch(() => {});
  }, [snap?.phase]);

  if (!api || !snap || snap.phase === "idle") return null;
  const { engine, minimized, setMinimized } = api;
  const partner = members.find((m) => m.slug === snap.call?.partnerSlug) ?? members[1];
  const first = partner?.displayName.split(" ")[0] ?? "";
  const video = snap.kind === "video" || snap.camOn || snap.remoteCamOn;
  const showRemote = snap.remoteCamOn && snap.remoteVideoLive && (snap.phase === "connected" || snap.phase === "reconnecting");
  // While a video call rings, your own camera fills the screen, as on a phone.
  const selfFull = !showRemote && snap.camOn && !!snap.local && (snap.phase === "outgoing" || snap.phase === "connecting" || snap.phase === "connected");
  const elapsed = snap.connectedAt ? duration(Math.max(1, (now - snap.connectedAt) / 1000)) || "0:00" : "";
  const status =
    snap.phase === "incoming"
      ? `Incoming ${snap.kind === "video" ? "video" : "voice"} call`
      : snap.phase === "outgoing"
        ? snap.call?.status === "ringing"
          ? "Ringing…"
          : "Calling…"
        : snap.phase === "connecting"
          ? "Connecting…"
          : snap.phase === "reconnecting"
            ? "Reconnecting…"
            : snap.phase === "ended"
              ? (snap.endedReason ?? "Call ended")
              : elapsed;

  if (minimized && snap.phase !== "incoming" && snap.phase !== "ended") {
    return (
      <div className="fixed bottom-24 right-3 z-[90] flex items-center gap-2 rounded-full bg-[#15121a]/95 py-1.5 pl-1.5 pr-2 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:bottom-6 sm:right-6">
        <button type="button" onClick={() => setMinimized(false)} className="flex items-center gap-2.5 pr-1" aria-label="Return to call">
          {showRemote ? (
            <span className="size-10 overflow-hidden rounded-full">
              <StreamVideo stream={snap.remote} className="size-full object-cover" />
            </span>
          ) : (
            partner && <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={40} />
          )}
          <span className="text-left leading-tight">
            <span className="block text-sm font-semibold">{first}</span>
            <span className="block text-xs tabular-nums text-emerald-300">{status}</span>
          </span>
        </button>
        <button type="button" onClick={() => engine.toggleMic()} className={`grid size-9 place-items-center rounded-full ${snap.micOn ? "bg-white/10" : "bg-white text-[#15121a]"}`} aria-label={snap.micOn ? "Mute" : "Unmute"}>
          {snap.micOn ? <IconMic size={17} /> : <IconMicOff size={17} />}
        </button>
        <button type="button" onClick={() => engine.hangup()} className="grid size-9 place-items-center rounded-full bg-[#e5484d]" aria-label="End call">
          <IconPhoneOff size={18} />
        </button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${snap.kind === "video" ? "Video" : "Voice"} call with ${first}`} className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#0b0910] text-white">
      {/* Backdrop: their video, or a night sky with their face. */}
      {showRemote ? (
        <StreamVideo stream={snap.remote} className="absolute inset-0 size-full bg-black object-cover sm:object-contain" />
      ) : selfFull ? (
        <>
          <StreamVideo stream={snap.local} mirrored={snap.facing === "user"} className="absolute inset-0 size-full bg-black object-cover" />
          <div className="absolute inset-0 bg-black/35" aria-hidden />
        </>
      ) : (
        <div className="stage absolute inset-0 !rounded-none" aria-hidden>
          <div className="aurora">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/75 to-transparent" />

      {/* Top bar */}
      <div className="relative z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {snap.phase !== "incoming" && snap.phase !== "ended" ? (
          <button type="button" onClick={() => setMinimized(true)} className="grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur-xl hover:bg-white/20" aria-label="Minimise call">
            <IconMinimize size={18} />
          </button>
        ) : (
          <span className="size-10" />
        )}
        <p className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-white/60">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          End-to-end encrypted
        </p>
        {snap.phase === "connected" || snap.phase === "reconnecting" ? (
          <span className="grid size-10 place-items-center" title={snap.quality === 3 ? "Excellent connection" : snap.quality === 2 ? "Fair connection" : "Weak connection"}>
            <IconSignal bars={snap.quality} size={20} className={snap.quality === 1 ? "text-amber-300" : "text-white/80"} />
          </span>
        ) : (
          <span className="size-10" />
        )}
      </div>

      {/* Who and what */}
      <div className={`relative z-10 flex flex-col items-center px-6 text-center ${showRemote ? "mt-4" : "mt-[12vh]"}`}>
        {!showRemote && !selfFull && partner && (
          <div className="relative mb-7 grid place-items-center">
            {(snap.phase === "incoming" || snap.phase === "outgoing") &&
              [0, 1, 2].map((i) => <span key={i} className="ring-wave absolute inset-0 rounded-full border border-[#f0dcae]/40" aria-hidden />)}
            <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={132} className="rounded-full shadow-[0_20px_60px_-10px_rgb(0_0_0/0.6)] ring-1 ring-white/20" />
          </div>
        )}
        <h2 className={`font-lux font-medium tracking-tight drop-shadow ${showRemote ? "text-2xl" : "text-5xl"}`}>{first}</h2>
        <p className={`mt-2 text-sm tabular-nums ${snap.phase === "reconnecting" ? "text-amber-300" : snap.phase === "ended" ? "text-white/80" : "text-white/70"}`} aria-live="polite">
          {status}
        </p>
        {!snap.remoteMicOn && snap.phase === "connected" && <p className="mt-2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80">{first} is muted</p>}
        {snap.notice && (
          <button type="button" onClick={() => engine.clearNotice()} className="mt-4 max-w-sm rounded-2xl bg-black/50 px-4 py-2.5 text-sm text-white/90 backdrop-blur">
            {snap.notice}
          </button>
        )}
        {snap.audioBlocked && (
          <button type="button" onClick={() => engine.unlockRemoteAudio()} className="btn-gold mt-5">
            <IconSpeaker size={18} /> Tap to hear {first}
          </button>
        )}
      </div>

      {snap.camOn && snap.local && !selfFull && snap.phase !== "ended" && <Pip stream={snap.local} mirrored={snap.facing === "user"} />}

      {/* Controls */}
      <div className="relative z-30 mt-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {snap.phase === "incoming" ? (
          <div className="mx-auto flex max-w-sm items-end justify-between">
            <Control label="Decline" tone="danger" size={68} onClick={() => engine.decline()}>
              <IconPhoneOff size={28} />
            </Control>
            <Control label="Accept" tone="accept" size={68} onClick={() => void engine.accept()}>
              <span className="ring-shake grid place-items-center">{snap.kind === "video" ? <IconVideo size={28} /> : <IconPhone size={26} />}</span>
            </Control>
          </div>
        ) : snap.phase === "ended" ? (
          <div className="flex justify-center">
            <button type="button" onClick={() => engine.dismiss()} className="btn-glass">
              Close
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md items-end justify-center gap-5 sm:gap-7">
            {sinks.length > 1 && (
              <Control
                label="Output"
                onClick={() => {
                  const next = (sink + 1) % sinks.length;
                  setSink(next);
                  void engine.setSpeaker(sinks[next].deviceId);
                }}
              >
                <IconSpeaker size={22} />
              </Control>
            )}
            <Control
              label={snap.camOn ? "Camera" : snap.kind === "video" ? "Camera off" : "Video"}
              on={!snap.camOn && snap.kind === "video"}
              onClick={() => void engine.toggleCam()}
            >
              {snap.camOn ? <IconVideo size={23} /> : <IconVideoOff size={23} />}
            </Control>
            {snap.camOn && snap.canFlip && (
              <Control label="Flip" onClick={() => void engine.flip()}>
                <IconFlip size={23} />
              </Control>
            )}
            <Control label={snap.micOn ? "Mute" : "Muted"} on={!snap.micOn} onClick={() => engine.toggleMic()}>
              {snap.micOn ? <IconMic size={23} /> : <IconMicOff size={23} />}
            </Control>
            <Control label="End" tone="danger" onClick={() => engine.hangup()}>
              <IconPhoneOff size={25} />
            </Control>
          </div>
        )}
        {video && snap.phase === "outgoing" && !snap.camOn && <p className="mt-4 text-center text-xs text-white/50">Your camera is off</p>}
      </div>
    </div>
  );
}
