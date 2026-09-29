"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EDIT_WINDOW_MS, QUICK_REACTIONS, type ChatMessage, type ChatQuote } from "@/lib/chat/types";
import { Avatar } from "@/components/avatar";
import { useCall } from "@/components/call/call-provider";
import { IconArrowDown, IconChevronLeft, IconCopy, IconPencil, IconPhone, IconReply, IconSend, IconTrash, IconVideo, IconX } from "@/components/icons";
import { useMe, useMembers } from "@/components/me-context";
import { PushPrompt } from "@/components/push";
import { Bubble, Quote, type Tick } from "./bubble";
import { dayLabel, lastSeen, sameDay } from "./format";
import { useChat, type OutboxItem } from "./use-chat";

type Menu = { message: ChatMessage; x: number; y: number; canEdit: boolean };

const coarse = () => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 640);

function outboxAsMessage(o: OutboxItem, slug: string): ChatMessage {
  return { id: -1, clientId: o.clientId, slug, kind: "text", body: o.body, replyTo: o.replyTo, call: null, reactions: {}, deleted: false, edited: false, createdAt: o.createdAt, updatedAt: o.createdAt };
}

/** Reactions, reply, copy, edit and delete for one message: a popover on desktop, a sheet on phones. */
function MessageMenu({ menu, mine, myReaction, onClose, onReact, onReply, onCopy, onEdit, onDelete }: {
  menu: Menu;
  mine: boolean;
  myReaction: string | null;
  onClose: () => void;
  onReact: (e: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: (() => void) | null;
  onDelete: () => void;
}) {
  const sheet = coarse();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (sheet || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ left: Math.max(12, Math.min(menu.x, window.innerWidth - r.width - 12)), top: Math.max(12, Math.min(menu.y, window.innerHeight - r.height - 12)) });
  }, [menu, sheet]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const m = menu.message;
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.95rem] transition hover:bg-surface-2";
  return (
    <div className="fixed inset-0 z-[85]" onPointerDown={(e) => e.target === e.currentTarget && onClose()} role="presentation">
      <div className={`absolute inset-0 ${sheet ? "bg-black/35 backdrop-blur-[2px]" : ""}`} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="menu"
        aria-label="Message options"
        className={sheet ? "rise absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-line bg-surface p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl" : "rise absolute w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl"}
        style={sheet ? undefined : { left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? "visible" : "hidden" }}
      >
        {sheet && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />}
        {m.kind === "text" && (
          <div className={`flex justify-between gap-1 ${sheet ? "mb-2 rounded-2xl bg-surface-2 p-2" : "mb-1 border-b border-line p-1.5 pb-2.5"}`}>
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                aria-label={`React ${e}`}
                aria-pressed={myReaction === e}
                className={`grid size-10 place-items-center rounded-full text-[1.4rem] transition hover:scale-110 ${myReaction === e ? "bg-accent-soft ring-1 ring-accent/40" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <button type="button" role="menuitem" className={item} onClick={onReply}>
          <IconReply size={18} className="text-muted" /> Reply
        </button>
        {m.kind === "text" && (
          <button type="button" role="menuitem" className={item} onClick={onCopy}>
            <IconCopy size={18} className="text-muted" /> Copy
          </button>
        )}
        {onEdit && (
          <button type="button" role="menuitem" className={item} onClick={onEdit}>
            <IconPencil size={18} className="text-muted" /> Edit
          </button>
        )}
        <button type="button" role="menuitem" className={`${item} text-red-600 dark:text-red-400`} onClick={onDelete}>
          <IconTrash size={18} /> Delete{mine ? "…" : " for me"}
        </button>
      </div>
    </div>
  );
}

function DeleteDialog({ canEveryone, onChoose, onClose }: { canEveryone: boolean; onChoose: (scope: "me" | "everyone") => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[86] grid place-items-center bg-black/40 p-6 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" className="rise w-full max-w-xs rounded-3xl border border-line bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p id="del-title" className="font-lux text-2xl font-medium">
          Delete message?
        </p>
        <p className="mt-1 text-sm text-muted">{canEveryone ? "Delete it for both of you, or only on your side." : "It will be removed from your chat only."}</p>
        <div className="mt-5 flex flex-col gap-2 text-sm font-semibold">
          {canEveryone && (
            <button type="button" className="rounded-2xl bg-red-600 px-4 py-3 text-white transition hover:bg-red-700" onClick={() => onChoose("everyone")}>
              Delete for everyone
            </button>
          )}
          <button type="button" className="rounded-2xl border border-line px-4 py-3 text-red-600 transition hover:bg-surface-2 dark:text-red-400" onClick={() => onChoose("me")}>
            Delete for me
          </button>
          <button type="button" className="rounded-2xl px-4 py-2.5 text-muted transition hover:bg-surface-2" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The two of you, WhatsApp-style: live typing, sent/delivered/read ticks,
 * swipe (or hold) to reply, reactions, edit, delete for me or for everyone,
 * and voice and video calls from the header.
 */
export function ChatView({ variant = "page" }: { variant?: "page" | "panel" }) {
  const me = useMe();
  const members = useMembers();
  const partnerP = members.find((m) => m.id !== me.id);
  const chat = useChat(me.slug);
  const call = useCall();
  const { messages, outbox, partner, markRead, typing } = chat;

  // The chat polls faster than the site-wide pulse, so an open chat is where a call rings first.
  const ringing = chat.call;
  useEffect(() => {
    if (call && ringing && ringing.role === "callee" && (ringing.status === "calling" || ringing.status === "ringing")) call.engine.incoming(ringing);
  }, [call, ringing]);

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatQuote | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const lastCount = useRef(0);
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);

  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.slug, m.id === me.id ? "You" : m.displayName.split(" ")[0]])), [members, me.id]);
  const themeOf = useCallback((slug: string) => members.find((m) => m.slug === slug)?.theme ?? "us", [members]);
  const first = partnerP?.displayName.split(" ")[0] ?? "";
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const say = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Phones: keep the composer above the on-screen keyboard.
  useEffect(() => {
    if (variant !== "page" || !window.visualViewport || window.innerWidth >= 640) return;
    const v = window.visualViewport;
    const fit = () => setVv({ h: v.height, top: v.offsetTop });
    fit();
    v.addEventListener("resize", fit);
    v.addEventListener("scroll", fit);
    return () => {
      v.removeEventListener("resize", fit);
      v.removeEventListener("scroll", fit);
    };
  }, [variant]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // First paint: jump to the first unread message, or the bottom.
  useLayoutEffect(() => {
    if (!chat.ready || didInitialScroll.current) return;
    didInitialScroll.current = true;
    const target = chat.firstUnread ? document.getElementById("unread-divider") : null;
    if (target) target.scrollIntoView({ block: "center" });
    else scrollToBottom(false);
    lastCount.current = messages.length + outbox.length;
  }, [chat.ready, chat.firstUnread, messages.length, outbox.length, scrollToBottom]);

  // Keep the reading position when older messages are added above.
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = olderAnchor.current;
    if (el && a && !chat.loadingOlder) {
      el.scrollTop = a.top + (el.scrollHeight - a.height);
      olderAnchor.current = null;
    }
  }, [messages, chat.loadingOlder]);

  // New messages: follow them if you're at the bottom (or sent them); otherwise count them.
  const lastMsg = messages.at(-1);
  useEffect(() => {
    if (!didInitialScroll.current) return;
    const count = messages.length + outbox.length;
    if (count > lastCount.current && !olderAnchor.current) {
      const mineNew = outbox.length > 0 || lastMsg?.slug === me.slug;
      if (atBottom || mineNew) requestAnimationFrame(() => scrollToBottom(true));
      else setUnseen((u) => u + (count - lastCount.current));
    }
    lastCount.current = count;
  }, [messages.length, outbox.length, lastMsg?.id, lastMsg?.slug, me.slug, atBottom, scrollToBottom]);

  // Reading: everything from them up to the bottom counts as read while this chat is on screen.
  const lastTheirs = useMemo(() => [...messages].reverse().find((m) => m.slug !== me.slug)?.id ?? 0, [messages, me.slug]);
  useEffect(() => {
    if (!chat.ready || !atBottom || !lastTheirs) return;
    const mark = () => document.visibilityState === "visible" && markRead(lastTheirs);
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [chat.ready, atBottom, lastTheirs, markRead]);

  // Older history loads as you reach the top.
  const { hasMore, loadingOlder, loadOlder } = chat;
  useEffect(() => {
    const el = topSentinel.current;
    const root = scroller.current;
    if (!el || !root || !hasMore) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting && !loadingOlder) {
          olderAnchor.current = { height: root.scrollHeight, top: root.scrollTop };
          void loadOlder();
        }
      },
      { root, rootMargin: "300px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingOlder, loadOlder]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom && unseen) setUnseen(0);
  };

  const jumpTo = (id: number) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return say("That message is further back — scroll up to load it.");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1700);
  };

  const quoteOf = (m: ChatMessage): ChatQuote => ({ id: m.id, slug: m.slug, kind: m.kind, body: m.kind === "call" ? "Call" : m.body.slice(0, 180), deleted: m.deleted });

  const startReply = (m: ChatMessage) => {
    setEditing(null);
    setReplyTo(quoteOf(m));
    setMenu(null);
    requestAnimationFrame(() => input.current?.focus());
  };

  const startEdit = (m: ChatMessage) => {
    setReplyTo(null);
    setEditing(m);
    setText(m.body);
    setMenu(null);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(m.body.length, m.body.length);
    });
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      if (body !== editing.body) chat.edit(editing.id, body);
      setEditing(null);
    } else {
      chat.send(body, replyTo);
      setReplyTo(null);
    }
    setText("");
    typing(false);
    requestAnimationFrame(() => input.current?.focus());
  };

  // Grow the composer with its text, up to about six lines.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 152)}px`;
  }, [text]);

  const tickFor = (m: ChatMessage): Tick | null => {
    if (m.slug !== me.slug || m.deleted || m.kind === "call") return null;
    if (partner && m.id <= partner.readUpTo) return "read";
    if (partner && m.id <= partner.deliveredUpTo) return "delivered";
    return "sent";
  };

  const status = partner?.typing ? "typing…" : partner?.online ? "online" : lastSeen(partner?.lastSeenAt ?? null);
  const inCall = !!call && call.snap.phase !== "idle" && call.snap.phase !== "ended";
  const canCall = !!call && !inCall;
  const startCall = (kind: "audio" | "video") => {
    if (!call) return;
    if (inCall) return call.setMinimized(false);
    call.start(kind);
  };

  // Build the rows: day separators, the unread divider, then each message.
  const rows: React.ReactNode[] = [];
  let prev: ChatMessage | null = null;
  const all = [...messages, ...outbox.map((o) => outboxAsMessage(o, me.slug))];
  all.forEach((m, i) => {
    const pending = m.id === -1 ? outbox.find((o) => o.clientId === m.clientId) : null;
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) {
      rows.push(
        <div key={`d-${m.createdAt}-${i}`} className="sticky top-2 z-10 my-3 flex justify-center">
          <span className="rounded-full border border-line bg-surface/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted shadow-sm backdrop-blur" suppressHydrationWarning>
            {dayLabel(m.createdAt)}
          </span>
        </div>,
      );
    }
    if (chat.firstUnread && m.id === chat.firstUnread) {
      rows.push(
        <div key="unread" id="unread-divider" className="my-4 flex items-center gap-3">
          <span className="rule-gold flex-1" />
          <span className="rounded-full border border-gold-2/50 bg-gold-soft px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-gold">Unread messages</span>
          <span className="rule-gold flex-1" />
        </div>,
      );
    }
    const firstInRun = !prev || prev.slug !== m.slug || !sameDay(prev.createdAt, m.createdAt) || prev.kind !== m.kind;
    // Replies show the latest version of the quoted message when it's loaded.
    const live = m.replyTo ? byId.get(m.replyTo.id) : null;
    const msg = live && m.replyTo ? { ...m, replyTo: quoteOf(live) } : m;
    rows.push(
      <div key={m.id === -1 ? m.clientId! : m.id} className={m.id === -1 || m.id > chat.baseline ? "bubble-in" : ""}>
        <Bubble
          message={msg}
          mine={m.slug === me.slug}
          first={firstInRun}
          tick={pending ? (pending.failed ? "failed" : "pending") : tickFor(m)}
          names={names}
          themeOf={themeOf}
          highlighted={flash === m.id}
          onReply={() => m.id !== -1 && startReply(m)}
          onMenu={(at) => m.id !== -1 && setMenu({ message: m, ...at, canEdit: m.slug === me.slug && m.kind === "text" && Date.now() - Date.parse(m.createdAt) < EDIT_WINDOW_MS })}
          onQuoteTap={jumpTo}
          onCallBack={canCall ? (kind) => startCall(kind) : undefined}
          onRetry={pending ? () => chat.retry(pending.clientId) : undefined}
          onDoubleTap={() => m.id !== -1 && chat.react(m.id, m.reactions[me.slug] === "❤️" ? null : "❤️")}
        />
      </div>,
    );
    prev = m;
  });

  const page = variant === "page";
  const shell = page
    ? "fixed inset-x-0 top-0 z-[45] flex h-dvh flex-col bg-bg sm:static sm:z-auto sm:mx-auto sm:mb-5 sm:mt-4 sm:h-[calc(100dvh-10.25rem)] sm:max-w-3xl sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-line sm:shadow-[0_30px_80px_-40px_rgb(0_0_0/0.35)]"
    : "flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-line bg-bg";

  return (
    <section className={shell} style={page && vv ? { height: vv.h, transform: `translateY(${vv.top}px)` } : undefined} aria-label={`Chat with ${first}`}>
      {/* Header */}
      <header className="glass relative z-20 flex items-center gap-3 border-b border-line px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 sm:pt-2">
        {page && (
          <Link href="/together" className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Back to Together">
            <IconChevronLeft size={22} />
          </Link>
        )}
        {partnerP && <Avatar name={partnerP.displayName} url={partnerP.avatarUrl} theme={partnerP.theme} size={page ? 42 : 36} online={partner?.online ?? null} />}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{first}</p>
          <p className={`truncate text-xs ${partner?.typing ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted"}`} suppressHydrationWarning aria-live="polite">
            {chat.ready ? status : " "}
          </p>
        </div>
        <button type="button" onClick={() => startCall("video")} className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-40" aria-label={`Video call ${first}`} title="Video call" disabled={!call}>
          <IconVideo size={22} />
        </button>
        <button type="button" onClick={() => startCall("audio")} className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-40" aria-label={`Voice call ${first}`} title="Voice call" disabled={!call}>
          <IconPhone size={20} />
        </button>
      </header>

      {page && <PushPrompt partnerName={first} />}

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className="chat-wall relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-5" role="log" aria-live="polite" aria-relevant="additions">
        <div ref={topSentinel} className="h-px" />
        {chat.loadingOlder && <p className="py-3 text-center text-xs text-muted">Loading earlier messages…</p>}
        {!chat.ready && !chat.error && (
          <div className="space-y-3 py-6" aria-label="Loading messages">
            {[62, 44, 70, 38, 55].map((w, i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                <div className="h-10 animate-pulse rounded-2xl bg-surface-2" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        )}
        {chat.ready && !hasMore && (
          <div className="mx-auto my-5 max-w-xs rounded-2xl border border-gold-2/40 bg-gold-soft/60 px-4 py-3 text-center text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">Every conversation is part of the journey.</span> Messages here are private to {first} and you.
          </div>
        )}
        {rows}
        {partner?.typing && (
          <div className="mt-2 flex" aria-label={`${first} is typing`}>
            <div data-world={partnerP?.theme} className="bubble-theirs bubble-in flex items-center gap-1 rounded-[18px] rounded-tl-[6px] px-4 py-3 text-muted shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        {chat.error && !chat.ready && (
          <div className="py-10 text-center text-sm text-muted">
            {chat.error}.{" "}
            <button className="font-semibold text-accent underline" onClick={chat.refresh}>
              Try again
            </button>
          </div>
        )}
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom(true);
            setUnseen(0);
          }}
          className="absolute bottom-24 right-4 z-20 grid size-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-lg"
          aria-label="Jump to latest"
        >
          <IconArrowDown size={18} />
          {unseen > 0 && <span className="absolute -top-1.5 -right-1 rounded-full bg-emerald-500 px-1.5 text-[0.65rem] font-bold text-white">{unseen}</span>}
        </button>
      )}

      {/* Composer */}
      <div className="glass relative z-20 border-t border-line px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-3">
        {(replyTo || editing) && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="min-w-0 flex-1">
              {replyTo ? (
                <Quote q={replyTo} names={{ ...names, [me.slug]: "Replying to yourself" }} themeOf={themeOf} onTap={() => jumpTo(replyTo.id)} />
              ) : (
                <div className="rounded-lg border-l-[3px] border-gold bg-surface-2/80 px-2.5 py-1.5">
                  <span className="block text-xs font-semibold text-gold">Editing message</span>
                  <span className="line-clamp-1 text-[0.8rem] text-muted">{editing!.body}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                if (editing) setText("");
                setEditing(null);
              }}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
              aria-label={editing ? "Cancel editing" : "Cancel reply"}
            >
              <IconX size={16} />
            </button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={input}
            rows={1}
            value={text}
            maxLength={4000}
            onChange={(e) => {
              setText(e.target.value);
              typing(e.target.value.trim().length > 0);
            }}
            onBlur={() => typing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !coarse()) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                setReplyTo(null);
                if (editing) {
                  setEditing(null);
                  setText("");
                }
              }
            }}
            placeholder={`Message ${first}`}
            aria-label={`Message ${first}`}
            className="max-h-38 min-h-[2.75rem] flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-[0.7rem] text-[0.95rem] leading-snug outline-none transition focus:border-[color-mix(in_oklab,var(--accent)_45%,var(--line))] focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_12%,transparent)]"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-md transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:opacity-40"
            aria-label={editing ? "Save edit" : "Send"}
            data-world="us"
          >
            {editing ? <IconPencil size={18} /> : <IconSend size={19} />}
          </button>
        </form>
      </div>

      {menu && (
        <MessageMenu
          menu={menu}
          mine={menu.message.slug === me.slug}
          myReaction={menu.message.reactions[me.slug] ?? null}
          onClose={() => setMenu(null)}
          onReact={(e) => {
            chat.react(menu.message.id, menu.message.reactions[me.slug] === e ? null : e);
            setMenu(null);
          }}
          onReply={() => startReply(menu.message)}
          onCopy={() => {
            void navigator.clipboard?.writeText(menu.message.body).then(() => say("Copied"), () => say("Couldn't copy"));
            setMenu(null);
          }}
          onEdit={menu.canEdit ? () => startEdit(menu.message) : null}
          onDelete={() => {
            setDeleting(menu.message);
            setMenu(null);
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          canEveryone={deleting.slug === me.slug && !deleting.deleted}
          onClose={() => setDeleting(null)}
          onChoose={(scope) => {
            chat.remove(deleting.id, scope);
            if (replyTo?.id === deleting.id) setReplyTo(null);
            setDeleting(null);
          }}
        />
      )}
      {(toast || (chat.error && chat.ready)) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">{toast ?? chat.error}</span>
        </div>
      )}
    </section>
  );
}
