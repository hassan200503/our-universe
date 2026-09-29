"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MODES, type Suggestion } from "@/lib/research/suggest";
import type { ResearchMessage, ResearchMode, ResearchSource, StreamEvent, ThreadSummary, ThreadView } from "@/lib/research/types";
import { Answer, SearchSuggestions, StudyStrip, WebSources } from "./answer";
import { QuizDialog } from "./quiz";
import { IconArrowRight, IconCheck, IconChevronDown, IconCopy, IconPlus, IconSend, IconSparkle, IconTrash, IconX } from "@/components/icons";

type Person = { slug: string; first: string; theme: string };
type Pending = { question: string; mode: ResearchMode; status: string; studies: ResearchSource[]; text: string; error?: string; retry?: boolean };

const MODE_LABEL: Record<ResearchMode, string> = { research: "Research", learn: "Lesson", explain: "Explained" };
const PLACEHOLDER: Record<ResearchMode, string> = {
  research: "What does the research say about…",
  learn: "What would you like to learn?",
  explain: "What should I explain simply?",
};

function setUrl(id: string | null) {
  const url = id ? `/research?t=${id}` : "/research";
  if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, "", url);
}

function plainCopy(m: ResearchMessage): string {
  const lines = [m.content];
  const studies = m.sources.filter((s) => s.kind === "study");
  const web = m.sources.filter((s) => s.kind === "web");
  if (studies.length) lines.push("", "Studies:", ...studies.map((s) => `[${s.n}] ${s.title}${s.year ? ` (${s.year})` : ""}. ${s.authors ?? ""} ${s.uri}`.trim()));
  if (web.length) lines.push("", "Web:", ...web.map((s) => `${s.title} ${s.uri}`));
  return lines.join("\n");
}

export function ResearchApp({
  initialThreads,
  initialThread,
  configured,
  suggestions,
  people,
  meFirst,
  autoAsk,
}: {
  initialThreads: ThreadSummary[];
  initialThread: ThreadView | null;
  configured: boolean;
  suggestions: Suggestion[];
  people: Person[];
  meFirst: string;
  autoAsk: { q: string; mode: ResearchMode } | null;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [active, setActive] = useState<ThreadView | null>(initialThread);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<ResearchMode>(autoAsk?.mode ?? initialThread?.mode ?? "research");
  const [draft, setDraft] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(() => new Set());
  const [copied, setCopied] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streaming = !!pending && !pending.error;
  const person = (slug: string) => people.find((p) => p.slug === slug);

  const flash = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3200);
  }, []);

  const ask = useCallback(
    async (raw: string, askMode: ResearchMode, threadId: string | null) => {
      const question = raw.trim();
      if (question.length < 2) return;
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      setPending({ question, mode: askMode, status: "Starting…", studies: [], text: "" });
      setDraft("");
      requestAnimationFrame(() => questionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

      let createdId: string | null = null;
      let finished = false;
      const fail = (message: string, retry = true) => {
        setPending((p) => (p ? { ...p, status: "", error: message, retry } : p));
        // A brand-new thread with nothing in it is removed on the server; do the same here.
        if (createdId) {
          const gone = createdId;
          setThreads((list) => list.filter((x) => x.id !== gone));
          setActive((a) => (a?.id === gone && a.messages.length === 0 ? null : a));
          setUrl(threadId);
        }
      };
      const handle = (ev: StreamEvent) => {
        switch (ev.t) {
          case "thread":
            if (!threadId) createdId = ev.thread.id;
            setActive((a) => (a?.id === ev.thread.id ? a : { ...ev.thread, messages: [] }));
            setThreads((list) => [ev.thread, ...list.filter((x) => x.id !== ev.thread.id)]);
            setUrl(ev.thread.id);
            break;
          case "status":
            setPending((p) => (p ? { ...p, status: ev.text } : p));
            break;
          case "studies":
            setPending((p) => (p ? { ...p, studies: ev.items } : p));
            break;
          case "delta":
            setPending((p) => (p ? { ...p, text: p.text + ev.text, status: "" } : p));
            break;
          case "done": {
            finished = true;
            const asked: ResearchMessage = { ...ev.message, id: -ev.message.id, role: "user", content: question, sources: [], queries: [], followUps: [], searchWidget: null, model: null, grounded: false };
            setActive((a) => (a ? { ...a, updatedAt: ev.message.createdAt, messages: [...a.messages, asked, ev.message] } : a));
            const id = threadId ?? createdId;
            setThreads((list) => {
              const t = list.find((x) => x.id === id);
              return t ? [{ ...t, updatedAt: ev.message.createdAt }, ...list.filter((x) => x.id !== id)] : list;
            });
            setPending(null);
            break;
          }
          case "error":
            finished = true;
            fail(ev.message, ev.retry);
            break;
        }
      };

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, mode: askMode, threadId }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          return fail(body?.error ?? "Research couldn't start. Try again.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) {
              try {
                handle(JSON.parse(line) as StreamEvent);
              } catch {
                /* a malformed line: skip it */
              }
            }
          }
        }
        if (!finished) fail("The connection dropped before the answer finished. Try again.");
      } catch {
        if (ctl.signal.aborted) {
          // Stopped: the server discards the question, so put it back in the box.
          setPending(null);
          setDraft(question);
          if (createdId) {
            const gone = createdId;
            setThreads((list) => list.filter((x) => x.id !== gone));
            setActive((a) => (a?.id === gone && a.messages.length === 0 ? null : a));
            setUrl(threadId);
          }
        } else fail("Couldn't reach the server. Check your connection and try again.");
      } finally {
        if (abortRef.current === ctl) abortRef.current = null;
      }
    },
    [],
  );

  // Arriving from the home page with ?q=…: start straight away (once).
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current || !autoAsk || !configured) return;
    autoRef.current = true;
    const t = setTimeout(() => void ask(autoAsk.q, autoAsk.mode, null), 0);
    return () => clearTimeout(t);
  }, [autoAsk, configured, ask]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!streaming && configured) void ask(draft, mode, active?.id ?? null);
  };

  const openThread = async (id: string) => {
    if (streaming) return;
    setDrawer(false);
    setConfirmDelete(false);
    if (active?.id === id) return;
    setOpening(id);
    try {
      const res = await fetch(`/api/research/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setThreads((list) => list.filter((x) => x.id !== id));
        flash("That thread is no longer available.");
        return;
      }
      const view = (await res.json()) as ThreadView;
      setPending(null);
      setActive(view);
      setMode(view.mode);
      setUrl(id);
      window.scrollTo({ top: 0 });
    } catch {
      flash("Couldn't open that thread. Check your connection.");
    } finally {
      setOpening(null);
    }
  };

  const startNew = () => {
    if (streaming) return;
    setActive(null);
    setPending(null);
    setDrawer(false);
    setConfirmDelete(false);
    setUrl(null);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const toggleShare = async () => {
    if (!active?.mine) return;
    const shared = !active.shared;
    setActive({ ...active, shared });
    setThreads((list) => list.map((x) => (x.id === active.id ? { ...x, shared } : x)));
    const res = await fetch(`/api/research/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shared }) }).catch(() => null);
    if (!res?.ok) {
      setActive((a) => (a?.id === active.id ? { ...a, shared: !shared } : a));
      setThreads((list) => list.map((x) => (x.id === active.id ? { ...x, shared: !shared } : x)));
      flash("Couldn't change sharing. Try again.");
    } else flash(shared ? "Shared. It's in your partner's Research too." : "Only you can see this now.");
  };

  const remove = async () => {
    if (!active?.mine) return;
    const id = active.id;
    const res = await fetch(`/api/research/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return flash("Couldn't delete it. Try again.");
    setThreads((list) => list.filter((x) => x.id !== id));
    startNew();
    flash("Deleted.");
  };

  const save = async (m: ResearchMessage) => {
    if (!active || saved.has(m.id)) return;
    const res = await fetch(`/api/research/${active.id}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: m.id }) }).catch(() => null);
    if (!res?.ok) return flash("Couldn't save it. Try again.");
    setSaved((s) => new Set(s).add(m.id));
    flash("Saved to Things we are learning.");
  };

  const copy = async (m: ResearchMessage) => {
    try {
      await navigator.clipboard.writeText(plainCopy(m));
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1800);
    } catch {
      flash("Couldn't copy on this device.");
    }
  };

  const followUp = (q: string) => {
    if (streaming || !configured) return;
    void ask(q, mode, active?.id ?? null);
  };

  const mine = threads.filter((t) => t.mine);
  const theirs = threads.filter((t) => !t.mine);
  const lastModel = active ? [...active.messages].reverse().find((m) => m.role === "model") : undefined;
  const hero = !active && !pending;

  const history = (
    <nav aria-label="Research history" className="space-y-6">
      <button onClick={startNew} disabled={streaming} className="btn w-full justify-center">
        <IconPlus size={16} /> New research
      </button>
      <Link href="/learning" className="group flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[0.82rem] text-muted transition hover:border-gold/60 hover:text-ink">
        <span className="flex-1">Things we are learning</span>
        <IconArrowRight size={14} className="transition group-hover:translate-x-0.5" />
      </Link>
      {threads.length === 0 && <p className="px-1 text-sm text-muted">Your questions will be kept here.</p>}
      {[
        { label: "Yours", list: mine },
        { label: "Shared with you", list: theirs },
      ].map(
        (group) =>
          group.list.length > 0 && (
            <div key={group.label}>
              <p className="px-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">{group.label}</p>
              <ul className="mt-2 space-y-0.5">
                {group.list.map((t) => {
                  const on = active?.id === t.id;
                  const owner = person(t.ownerSlug);
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => void openThread(t.id)}
                        disabled={streaming && !on}
                        aria-current={on ? "page" : undefined}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-gold-soft" : "hover:bg-surface-2"} disabled:opacity-50`}
                      >
                        <span className="line-clamp-2 text-[0.86rem] leading-snug">{t.title}</span>
                        <span className="mt-1 flex items-center gap-2 text-[0.68rem] text-muted">
                          {MODE_LABEL[t.mode]}
                          {!t.mine && owner && (
                            <span data-world={owner.theme} className="text-accent">
                              from {owner.first}
                            </span>
                          )}
                          {t.mine && t.shared && <span className="text-gold">shared</span>}
                          {opening === t.id && <span className="ml-auto animate-pulse">opening…</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
    </nav>
  );

  const composer = (big: boolean) => (
    <form onSubmit={submit} className={big ? "mt-8" : ""}>
      {big && (
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How to answer">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                title={m.hint}
                onClick={() => setMode(m.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${mode === m.key ? "border-transparent bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{MODES.find((m) => m.key === mode)?.hint}</p>
        </>
      )}
      <div className={`research-box flex items-end gap-2 rounded-[1.4rem] border border-line bg-surface p-2 ${big ? "mt-3 pl-4 shadow-[0_24px_60px_-32px_var(--glow)]" : "shadow-[0_18px_44px_-24px_rgb(0_0_0/0.35)]"}`}>
        {!big && (
          <label className="relative mb-0.5 shrink-0">
            <span className="sr-only">How to answer</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ResearchMode)}
              disabled={streaming}
              className="h-9 appearance-none rounded-full bg-surface-2 pl-3 pr-7 text-xs font-semibold text-ink outline-none transition hover:bg-gold-soft focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.short}
                </option>
              ))}
            </select>
            <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </label>
        )}
        <label htmlFor={big ? "research-q-big" : "research-q"} className="sr-only">
          Your question
        </label>
        <textarea
          ref={inputRef}
          id={big ? "research-q-big" : "research-q"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={big ? 2 : 1}
          maxLength={2000}
          disabled={!configured}
          placeholder={active ? "Ask a follow-up…" : PLACEHOLDER[mode]}
          className={`max-h-48 min-w-0 flex-1 resize-none bg-transparent py-2 outline-none [field-sizing:content] placeholder:text-muted/80 ${big ? "text-lg" : "text-[0.95rem]"}`}
        />
        {streaming ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-bg" aria-label="Stop answering">
            <span className="size-3 rounded-[3px] bg-current" />
          </button>
        ) : (
          <button disabled={!configured || draft.trim().length < 2} className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition disabled:opacity-35" aria-label="Ask">
            <IconSend size={18} />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div data-world="us" className="mx-auto grid max-w-6xl gap-8 px-4 pb-40 pt-6 sm:pt-10 lg:grid-cols-[15.5rem_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1">{history}</div>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" onClick={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className="drawer-in h-full w-[84%] max-w-xs overflow-y-auto border-r border-line bg-bg p-4 pt-5 shadow-[20px_0_60px_-30px_rgb(0_0_0/0.5)]" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-lux text-2xl">History</p>
              <button onClick={() => setDrawer(false)} aria-label="Close history" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
                <IconX size={18} />
              </button>
            </div>
            {history}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <button onClick={() => setDrawer(true)} className="btn btn-ghost px-3.5 py-2 text-xs">
            History{threads.length ? ` · ${threads.length}` : ""}
          </button>
          {!hero && (
            <button onClick={startNew} disabled={streaming} className="btn btn-ghost px-3.5 py-2 text-xs">
              <IconPlus size={14} /> New
            </button>
          )}
        </div>

        {hero && (
          <section className="mx-auto max-w-3xl pt-2 sm:pt-8">
            <p className="eyebrow-lux">Research</p>
            <h1 className="font-lux mt-4 text-balance text-[2.7rem] font-medium leading-[1.02] tracking-tight sm:text-[4rem]">What are you curious about, {meFirst}?</h1>
            <p className="mt-4 max-w-2xl text-muted">Ask anything. Research reads real studies and cites every claim; Learn teaches it step by step and checks you understood; Explain gives you the simple version.</p>
            {configured ? (
              <>
                {composer(true)}
                <div className="mt-8">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Try one</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((s) => (
                      <li key={s.q}>
                        <button
                          onClick={() => {
                            setMode(s.mode);
                            void ask(s.q, s.mode, null);
                          }}
                          className="tile lift group flex h-full w-full items-start gap-3 p-4 text-left"
                        >
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gold-soft text-gold">
                            <IconSparkle size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.9rem] leading-snug">{s.q}</span>
                            <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.14em] text-muted">{MODES.find((m) => m.key === s.mode)?.label}</span>
                          </span>
                          <IconArrowRight size={15} className="mt-1 shrink-0 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="card-glow mt-8 p-6">
                <p className="font-semibold">Research needs a Gemini API key first.</p>
                <p className="mt-1 text-sm text-muted">It&apos;s free: create one at aistudio.google.com → Get API key, then paste it once in Settings. Either of you can add it, and it works for both.</p>
                <Link href="/settings#ai" className="btn mt-4">
                  Add the key in Settings <IconArrowRight size={15} />
                </Link>
              </div>
            )}
          </section>
        )}

        {active && (
          <header className="mx-auto max-w-3xl border-b border-line pb-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="chip">{MODE_LABEL[active.mode]}</span>
              {!active.mine && person(active.ownerSlug) && (
                <span data-world={person(active.ownerSlug)!.theme} className="text-accent">
                  Shared by {person(active.ownerSlug)!.first}
                </span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {lastModel && (
                  <button onClick={() => setQuizOpen(true)} disabled={streaming} className="btn btn-ghost px-3 py-1.5 text-xs">
                    Quiz me
                  </button>
                )}
                {active.mine && active.messages.length > 0 && (
                  <button onClick={() => void toggleShare()} aria-pressed={active.shared} className={`btn px-3 py-1.5 text-xs ${active.shared ? "" : "btn-ghost"}`}>
                    {active.shared ? <IconCheck size={13} /> : null}
                    {active.shared ? "Shared" : "Share with partner"}
                  </button>
                )}
                {active.mine &&
                  active.messages.length > 0 &&
                  (confirmDelete ? (
                    <span className="flex items-center gap-1">
                      <button onClick={() => void remove()} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                        Delete
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="rounded-full px-2 py-1.5 text-xs">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} disabled={streaming} aria-label="Delete this research" className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-red-600">
                      <IconTrash size={15} />
                    </button>
                  ))}
              </div>
            </div>
          </header>
        )}

        <div className="mx-auto max-w-3xl">
          {active?.messages.map((m, idx) =>
            m.role === "user" ? (
              <h2 key={m.id} className={`font-lux text-balance text-[1.85rem] font-medium leading-[1.1] tracking-tight sm:text-[2.3rem] ${idx === 0 ? "mt-6" : "mt-14 border-t border-line pt-10"}`}>
                {m.content}
              </h2>
            ) : (
              <article key={m.id} className="mt-2">
                <StudyStrip items={m.sources} />
                <div className="mt-5">
                  <Answer text={m.content} sources={m.sources} />
                </div>
                <WebSources items={m.sources} />
                {m.searchWidget && <SearchSuggestions html={m.searchWidget} />}
                <p className="mt-4 text-[0.72rem] text-muted">
                  {m.grounded ? "Checked against Google Search" : m.sources.some((s) => s.kind === "study") ? "Based on the studies above" : "From Gemini's own knowledge, without live sources"}
                  {" · "}AI can make mistakes; open the sources for anything important.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button onClick={() => void copy(m)} className="btn btn-ghost px-3 py-1.5 text-xs">
                    {copied === m.id ? <IconCheck size={13} /> : <IconCopy size={13} />}
                    {copied === m.id ? "Copied" : "Copy"}
                  </button>
                  <button onClick={() => void save(m)} disabled={saved.has(m.id)} className="btn btn-ghost px-3 py-1.5 text-xs">
                    {saved.has(m.id) ? <IconCheck size={13} /> : <IconPlus size={13} />}
                    {saved.has(m.id) ? "Saved to learning" : "Save to learning"}
                  </button>
                </div>
                {m === lastModel && !pending && m.followUps.length > 0 && (
                  <div className="mt-7">
                    <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Go further</p>
                    <ul className="mt-2 divide-y divide-line border-y border-line">
                      {m.followUps.map((f) => (
                        <li key={f}>
                          <button onClick={() => followUp(f)} disabled={!configured} className="group flex w-full items-center gap-3 py-3 text-left text-[0.92rem] transition hover:text-accent">
                            <IconPlus size={14} className="shrink-0 text-gold" />
                            <span className="flex-1">{f}</span>
                            <IconArrowRight size={14} className="shrink-0 opacity-0 transition group-hover:opacity-100" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ),
          )}

          {pending && (
            <div ref={questionRef} className="scroll-mt-24">
              <h2 className={`font-lux text-balance text-[1.85rem] font-medium leading-[1.1] tracking-tight sm:text-[2.3rem] ${active?.messages.length ? "mt-14 border-t border-line pt-10" : "mt-6"}`}>{pending.question}</h2>
              <StudyStrip items={pending.studies} />
              {pending.status && !pending.error && (
                <p className="mt-5 flex items-center gap-2.5 text-sm text-muted" aria-live="polite">
                  <span className="research-dots" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  {pending.status}
                </p>
              )}
              {pending.text && (
                <div className="mt-5">
                  <Answer text={pending.text} sources={pending.studies} streaming={!pending.error} />
                </div>
              )}
              {pending.error && (
                <div role="alert" className="mt-6 rounded-2xl border border-red-300/60 bg-red-500/5 p-4 text-sm">
                  <p>{pending.error}</p>
                  <div className="mt-3 flex gap-2">
                    {pending.retry !== false && (
                      <button onClick={() => void ask(pending.question, pending.mode, active?.messages.length ? active.id : null)} className="btn px-3.5 py-1.5 text-xs">
                        Try again
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDraft(pending.question);
                        setPending(null);
                      }}
                      className="btn btn-ghost px-3.5 py-1.5 text-xs"
                    >
                      Edit question
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!hero && configured && (
          <div className="research-dock sticky bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-20 mx-auto mt-10 max-w-3xl pt-6 sm:bottom-0 sm:pb-5">{composer(false)}</div>
        )}
      </div>

      {quizOpen && active && <QuizDialog key={active.id} threadId={active.id} title={active.title} onClose={() => setQuizOpen(false)} />}

      {toast && (
        <div role="status" className="glass fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[90vw] rounded-full border border-line px-4 py-2 text-sm shadow-lg sm:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
