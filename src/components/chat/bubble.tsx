"use client";

import { useRef, useState } from "react";
import type { ChatMessage, ChatQuote } from "@/lib/chat/types";
import { IconArrowDownLeft, IconArrowUpRight, IconCheck, IconChecks, IconChevronDown, IconClock, IconPhone, IconReply, IconVideo } from "@/components/icons";
import { clock, duration, isEmojiOnly, linkify } from "./format";
import { buzz } from "@/lib/ui/buzz";

export type Tick = "pending" | "failed" | "sent" | "delivered" | "read";

type Props = {
  message: ChatMessage;
  mine: boolean;
  /** First bubble in a run from the same person: gets the tail and a little more space. */
  first: boolean;
  tick: Tick | null;
  names: Record<string, string>;
  themeOf: (slug: string) => string;
  highlighted: boolean;
  onReply: () => void;
  onMenu: (at: { x: number; y: number }) => void;
  onQuoteTap: (id: number) => void;
  onCallBack?: (kind: "audio" | "video") => void;
  onRetry?: () => void;
  onDoubleTap?: () => void;
};

const SWIPE_FIRE = 58;
const SWIPE_MAX = 86;

function Ticks({ tick }: { tick: Tick }) {
  if (tick === "pending") return <IconClock size={13} className="opacity-60" />;
  if (tick === "failed") return <span className="text-[0.7rem] font-bold text-red-500">!</span>;
  if (tick === "sent") return <IconCheck size={15} strokeWidth={2} className="opacity-60" />;
  return <IconChecks size={16} strokeWidth={2} className={tick === "read" ? "text-sky-500 dark:text-sky-400" : "opacity-60"} />;
}

export function Quote({ q, names, themeOf, mine, onTap }: { q: ChatQuote; names: Record<string, string>; themeOf: (s: string) => string; mine?: boolean; onTap?: () => void }) {
  return (
    <button
      type="button"
      data-world={themeOf(q.slug)}
      onClick={(e) => {
        e.stopPropagation();
        onTap?.();
      }}
      className={`mb-1 block w-full min-w-0 overflow-hidden rounded-lg border-l-[3px] border-accent px-2.5 py-1.5 text-left ${mine ? "bg-black/[0.05] dark:bg-white/[0.07]" : "bg-surface-2/80 dark:bg-black/20"}`}
    >
      <span className="block text-xs font-semibold text-accent">{names[q.slug] ?? "Them"}</span>
      <span className="line-clamp-2 text-[0.8rem] text-muted">{q.deleted ? "This message was deleted" : q.kind === "call" ? "📞 Call" : q.body}</span>
    </button>
  );
}

function CallLine({ m, mine, onCallBack }: { m: ChatMessage; mine: boolean; onCallBack?: (kind: "audio" | "video") => void }) {
  const c = m.call!;
  const video = c.callKind === "video";
  const kind = video ? "video call" : "voice call";
  // Told from each side, the way phones do: the caller sees "No answer", the other person "Missed".
  const missedHere = !mine && c.outcome === "missed";
  const title = missedHere ? `Missed ${kind}` : video ? "Video call" : "Voice call";
  const detail =
    c.outcome === "completed"
      ? duration(c.durationSec) || "Connected"
      : c.outcome === "missed"
        ? mine
          ? "No answer"
          : "Tap to call back"
        : c.outcome === "declined"
          ? mine
            ? "Declined"
            : "You declined"
          : "Couldn't connect";
  const Dir = mine ? IconArrowUpRight : IconArrowDownLeft;
  return (
    <button type="button" onClick={() => onCallBack?.(c.callKind)} className="inline-flex items-center gap-3 py-0.5 pr-1 text-left" title={`Call back (${kind})`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${missedHere ? "bg-red-500/12 text-red-500" : "bg-black/5 text-ink dark:bg-white/10"}`}>
        {video ? <IconVideo size={19} /> : <IconPhone size={18} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[0.92rem] font-semibold ${missedHere ? "text-red-500" : ""}`}>{title}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Dir size={13} className={c.outcome === "completed" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"} strokeWidth={2} />
          {detail}
        </span>
      </span>
    </button>
  );
}

/** One message. Swipe right (or use the menu) to reply; hold, right-click or tap the chevron for more. */
export function Bubble({ message: m, mine, first, tick, names, themeOf, highlighted, onReply, onMenu, onQuoteTap, onCallBack, onRetry, onDoubleTap }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef<{ x: number; y: number; id: number; mode: "idle" | "swipe" | "scroll"; fired: boolean; press?: ReturnType<typeof setTimeout>; long: boolean } | null>(null);
  const big = m.kind === "text" && !m.deleted && !m.replyTo && isEmojiOnly(m.body);
  const reactions = Object.entries(m.reactions);

  const clearPress = () => {
    if (g.current?.press) clearTimeout(g.current.press);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || m.deleted) return;
    const touch = e.pointerType !== "mouse";
    g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: "idle", fired: false, long: false };
    if (touch) {
      g.current.press = setTimeout(() => {
        if (g.current && g.current.mode === "idle") {
          g.current.long = true;
          buzz(12);
          onMenu({ x: e.clientX, y: e.clientY });
        }
      }, 460);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (s.mode === "idle") {
      if (Math.abs(ddy) > 10) {
        s.mode = "scroll";
        clearPress();
        return;
      }
      if (ddx > 10 && ddx > Math.abs(ddy) * 1.3) {
        s.mode = "swipe";
        clearPress();
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* the pointer was already released */
        }
      } else if (Math.abs(ddx) > 10) {
        clearPress();
      }
    }
    if (s.mode === "swipe") {
      const eased = ddx < 60 ? Math.max(0, ddx) : 60 + (ddx - 60) * 0.35;
      const x = Math.min(SWIPE_MAX, eased);
      setDx(x);
      if (!s.fired && x >= SWIPE_FIRE) {
        s.fired = true;
        buzz(8);
      } else if (s.fired && x < SWIPE_FIRE - 8) {
        s.fired = false;
      }
    }
  };
  const end = () => {
    const s = g.current;
    clearPress();
    if (s?.mode === "swipe" && s.fired) onReply();
    g.current = null;
    setDragging(false);
    setDx(0);
  };

  const body = m.deleted ? (
    <span className="inline-flex items-center gap-1.5 italic text-muted">
      <span aria-hidden>⊘</span> {mine ? "You deleted this message" : "This message was deleted"}
    </span>
  ) : m.kind === "call" ? (
    <CallLine m={m} mine={mine} onCallBack={onCallBack} />
  ) : (
    <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${big ? "text-[2.6rem] leading-tight" : ""}`}>
      {linkify(m.body).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline decoration-sky-600/40 underline-offset-2 dark:text-sky-400" onClick={(e) => e.stopPropagation()}>
            {p.t}
          </a>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </span>
  );

  return (
    <div
      id={`m-${m.id}`}
      className={`group relative flex ${mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"} ${highlighted ? "flash" : ""} rounded-xl`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => {
        if (m.deleted) return;
        e.preventDefault();
        if (!g.current?.long) onMenu({ x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={() => !m.deleted && m.kind === "text" && onDoubleTap?.()}
    >
      {/* The reply arrow that appears as you swipe. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-muted shadow-sm ring-1 ring-line"
        style={{ opacity: Math.min(1, dx / SWIPE_FIRE), transform: `translateY(-50%) scale(${0.6 + Math.min(1, dx / SWIPE_FIRE) * 0.4})` }}
      >
        <IconReply size={16} />
      </span>
      <div
        data-world={themeOf(m.slug)}
        className={`relative max-w-[82%] sm:max-w-[70%] ${dragging ? "" : "transition-transform duration-300 ease-out"}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {/* Desktop: reply and options sit beside the bubble on hover, never over the text. */}
        {!m.deleted && (
          <div className={`absolute top-1/2 hidden -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 [@media(hover:hover)]:flex ${mine ? "right-full mr-1.5 flex-row-reverse" : "left-full ml-1.5"}`}>
            <button
              type="button"
              aria-label="Reply"
              onClick={(e) => {
                e.stopPropagation();
                onReply();
              }}
              className="grid size-7 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink hover:shadow-sm"
            >
              <IconReply size={15} />
            </button>
            <button
              type="button"
              aria-label="Message options"
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onMenu({ x: r.left, y: r.bottom + 4 });
              }}
              className="grid size-7 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink hover:shadow-sm"
            >
              <IconChevronDown size={15} />
            </button>
          </div>
        )}
        <div
          className={`relative flow-root text-[0.95rem] leading-[1.38] text-ink select-none [-webkit-touch-callout:none] [@media(hover:hover)]:select-text ${
            big ? "px-1" : `rounded-[18px] px-3 pb-1.5 pt-1.5 shadow-[0_1px_1px_rgb(0_0_0/0.06)] ${mine ? "bubble-mine" : "bubble-theirs"} ${first ? (mine ? "rounded-tr-[6px]" : "rounded-tl-[6px]") : ""}`
          }`}
        >
          {m.replyTo && !m.deleted && <Quote q={m.replyTo} names={names} themeOf={themeOf} mine={mine} onTap={() => onQuoteTap(m.replyTo!.id)} />}
          {body}
          {/* Time and ticks sit in the bubble's bottom-right corner, floated so text wraps around them. */}
          <span className={`float-right ml-2.5 mt-1.5 flex translate-y-0.5 select-none items-center gap-1 text-[0.68rem] leading-none text-muted ${big ? "rounded-full bg-surface/80 px-1.5 py-1" : ""}`}>
            {m.edited && <span className="italic">edited</span>}
            <span suppressHydrationWarning>{clock(m.createdAt)}</span>
            {tick && <Ticks tick={tick} />}
          </span>
        </div>
        {reactions.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onMenu({ x: r.left, y: r.bottom });
            }}
            className={`relative -mt-1.5 flex w-fit items-center gap-0.5 rounded-full border border-line bg-surface px-1.5 py-0.5 text-sm shadow-sm ${mine ? "ml-auto mr-2" : "ml-2"}`}
            aria-label={`Reactions: ${reactions.map(([s, e]) => `${names[s] ?? s} ${e}`).join(", ")}`}
          >
            {[...new Set(reactions.map(([, e]) => e))].map((e) => (
              <span key={e}>{e}</span>
            ))}
            {reactions.length > 1 && <span className="pl-0.5 text-[0.7rem] text-muted">{reactions.length}</span>}
          </button>
        )}
        {tick === "failed" && (
          <button type="button" onClick={onRetry} className="mt-1 block w-full text-right text-xs font-semibold text-red-500">
            Not sent · tap to retry
          </button>
        )}
      </div>
    </div>
  );
}
