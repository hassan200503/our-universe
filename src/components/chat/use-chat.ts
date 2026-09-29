"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatPartner, ChatQuote, ChatSync } from "@/lib/chat/types";
import type { CallView } from "@/lib/calls/types";

export type OutboxItem = { clientId: string; body: string; replyTo: ChatQuote | null; createdAt: string; failed: boolean };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

async function post(body: unknown) {
  const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({ ok: false, error: "Network error" }))) as { ok: boolean; error?: string; message?: ChatMessage };
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

/**
 * The chat's live state. Polls for changes every 1.5 s while you're both
 * online (4 s otherwise, paused in the background); sends are shown at once
 * and confirmed by the server, and a retried send is stored only once.
 */
export function useChat(meSlug: string) {
  const [byId, setById] = useState<Map<number, ChatMessage>>(new Map());
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [partner, setPartner] = useState<ChatPartner | null>(null);
  const [call, setCall] = useState<CallView | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The first message that was unread when the chat opened (for the divider). */
  const [firstUnread, setFirstUnread] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Newest message when the chat opened: anything after it animates in. */
  const [baseline, setBaseline] = useState(0);

  const since = useRef<string | null>(null);
  const partnerOnline = useRef(false);
  const readSent = useRef(0);
  const typingSentAt = useRef(0);
  const poke = useRef<() => void>(() => {});

  const merge = useCallback((list: ChatMessage[], removed: number[] = []) => {
    if (!list.length && !removed.length) return;
    setById((prev) => {
      const next = new Map(prev);
      for (const m of list) next.set(m.id, m);
      for (const id of removed) next.delete(id);
      return next;
    });
    const confirmed = new Set(list.map((m) => m.clientId).filter(Boolean));
    if (confirmed.size) setOutbox((o) => o.filter((x) => !confirmed.has(x.clientId)));
  }, []);

  const absorb = useCallback(
    (s: ChatSync) => {
      since.current = s.serverNow;
      setPartner(s.partner);
      setCall(s.call ?? null);
      partnerOnline.current = !!s.partner?.online;
      merge(s.messages, s.removed);
    },
    [merge],
  );

  // First page, then polling.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;

    const tick = async () => {
      if (busy) return;
      clearTimeout(timer);
      busy = true;
      try {
        if (!since.current) {
          const res = await fetch("/api/chat", { cache: "no-store" });
          if (!res.ok) throw new Error("Couldn't load messages");
          const s = (await res.json()) as ChatSync;
          if (stopped) return;
          absorb(s);
          setHasMore(!!s.hasMore);
          setFirstUnread(s.messages.find((m) => m.slug !== meSlug && m.id > s.myReadUpTo && !m.deleted)?.id ?? null);
          setBaseline(s.messages.at(-1)?.id ?? 0);
          setReady(true);
          setError(null);
        } else if (document.visibilityState === "visible") {
          const res = await fetch(`/api/chat?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
          if (res.ok) {
            absorb((await res.json()) as ChatSync);
            setError(null);
          }
        }
      } catch (e) {
        if (!since.current) setError(e instanceof Error ? e.message : "Couldn't load messages");
      } finally {
        busy = false;
      }
      if (stopped) return;
      const visible = document.visibilityState === "visible";
      timer = setTimeout(tick, !since.current ? 3000 : visible && partnerOnline.current ? 1500 : 4000);
    };
    poke.current = () => void tick();
    tick();
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [absorb, meSlug]);

  const loadOlder = useCallback(async () => {
    const oldest = Math.min(...byId.keys());
    if (!hasMore || loadingOlder || !Number.isFinite(oldest)) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/chat?before=${oldest}`, { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as ChatSync;
        merge(s.messages);
        setHasMore(!!s.hasMore);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [byId, hasMore, loadingOlder, merge]);

  const deliver = useCallback(
    async (item: OutboxItem) => {
      try {
        const r = await post({ type: "send", clientId: item.clientId, body: item.body, replyTo: item.replyTo?.id ?? null });
        if (r.message) merge([r.message]);
        poke.current();
      } catch {
        setOutbox((o) => o.map((x) => (x.clientId === item.clientId ? { ...x, failed: true } : x)));
      }
    },
    [merge],
  );

  const send = useCallback(
    (body: string, replyTo: ChatQuote | null) => {
      const text = body.trim();
      if (!text) return;
      typingSentAt.current = 0;
      const item: OutboxItem = { clientId: newId(), body: text, replyTo, createdAt: new Date().toISOString(), failed: false };
      setOutbox((o) => [...o, item]);
      void deliver(item);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const item = outbox.find((x) => x.clientId === clientId);
      if (!item) return;
      setOutbox((o) => o.map((x) => (x.clientId === clientId ? { ...x, failed: false } : x)));
      void deliver({ ...item, failed: false });
    },
    [outbox, deliver],
  );

  const discard = useCallback((clientId: string) => setOutbox((o) => o.filter((x) => x.clientId !== clientId)), []);

  const patch = useCallback((id: number, fn: (m: ChatMessage) => ChatMessage | null) => {
    setById((prev) => {
      const m = prev.get(id);
      if (!m) return prev;
      const next = new Map(prev);
      const updated = fn(m);
      if (updated) next.set(id, updated);
      else next.delete(id);
      return next;
    });
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const r = await post(body);
        if (r.message) merge([r.message]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setTimeout(() => setError(null), 4000);
      } finally {
        poke.current();
      }
    },
    [merge],
  );

  const edit = useCallback(
    (id: number, body: string) => {
      patch(id, (m) => ({ ...m, body, edited: true }));
      void act({ type: "edit", id, body });
    },
    [patch, act],
  );

  const remove = useCallback(
    (id: number, scope: "me" | "everyone") => {
      patch(id, (m) => (scope === "me" ? null : { ...m, deleted: true, body: "", reactions: {}, replyTo: null }));
      void act({ type: "delete", id, scope });
    },
    [patch, act],
  );

  const react = useCallback(
    (id: number, emoji: string | null) => {
      patch(id, (m) => {
        const reactions = { ...m.reactions };
        if (emoji) reactions[meSlug] = emoji;
        else delete reactions[meSlug];
        return { ...m, reactions };
      });
      void act({ type: "react", id, emoji });
    },
    [patch, act, meSlug],
  );

  /** Call on every keystroke; tells the other side at most every 3 s. */
  const typing = useCallback((on: boolean) => {
    const now = Date.now();
    if (on && now - typingSentAt.current < 3000) return;
    if (!on && typingSentAt.current === 0) return;
    typingSentAt.current = on ? now : 0;
    void post({ type: "typing", on }).catch(() => {});
  }, []);

  const markRead = useCallback((upTo: number) => {
    if (upTo <= readSent.current) return;
    readSent.current = upTo;
    void post({ type: "read", upTo })
      .then(() => window.dispatchEvent(new Event("ou:pulse")))
      .catch(() => {
        readSent.current = 0;
      });
  }, []);

  const messages = useMemo(() => [...byId.values()].sort((a, b) => a.id - b.id), [byId]);

  return { messages, outbox, partner, call, hasMore, ready, error, firstUnread, baseline, loadingOlder, loadOlder, send, retry, discard, edit, remove, react, typing, markRead, refresh: () => poke.current() };
}
