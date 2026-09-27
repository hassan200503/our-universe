"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { noteOnDiscovery, saveToStory, saveToVault, toggleReaction } from "@/lib/actions/shared";
import type { TrendCard } from "@/lib/trends/query";
import { useMe } from "@/components/me-context";
import { isoDay } from "@/lib/ui/time";

const KINDS = [
  { kind: "save", icon: "❤️", label: "Save" },
  { kind: "favorite", icon: "⭐", label: "Favourite" },
  { kind: "bookmark", icon: "📌", label: "Bookmark" },
] as const;

function StoryDialog({ item, open, onClose }: { item: TrendCard; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveToStory, null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 900);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);
  return (
    <dialog ref={ref} onClose={onClose} data-world="us" className="card m-auto w-[min(32rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <form action={action} className="p-5">
        <p className="eyebrow">Save to Our Story</p>
        <h2 className="font-display mt-1 text-xl font-semibold leading-snug">{item.title}</h2>
        <input type="hidden" name="trendId" value={item.id} />
        <label className="mt-4 block text-sm font-semibold" htmlFor={`why-${item.id}`}>
          Why did it catch your eye?
        </label>
        <textarea id={`why-${item.id}`} name="why" className="field mt-1" placeholder="It reminded me of…" />
        <label className="mt-3 block text-sm font-semibold" htmlFor={`note-${item.id}`}>
          A note for us <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id={`note-${item.id}`} name="note" className="field mt-1 min-h-16" />
        <label className="mt-3 block text-sm font-semibold" htmlFor={`date-${item.id}`}>
          Date
        </label>
        <input id={`date-${item.id}`} type="date" name="occurredOn" defaultValue={isoDay()} className="field mt-1" />
        {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="mt-2 text-sm text-accent">{state.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button className="btn" disabled={pending}>
            {pending ? "Saving…" : "Keep this memory"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function Reactions({ item }: { item: TrendCard }) {
  const me = useMe();
  const [mine, setMine] = useState<string[]>(item.reactions[me.slug] ?? []);
  const [pending, start] = useTransition();
  const [story, setStory] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const partners = Object.entries(item.reactions).filter(([slug]) => slug !== me.slug);

  function toggle(kind: string) {
    const was = mine.includes(kind);
    setMine((m) => (was ? m.filter((k) => k !== kind) : [...m, kind]));
    start(async () => {
      try {
        const { on } = await toggleReaction(item.id, kind);
        setMine((m) => (on ? [...new Set([...m, kind])] : m.filter((k) => k !== kind)));
      } catch {
        setMine((m) => (was ? [...m, kind] : m.filter((k) => k !== kind)));
        setFlash("Couldn't save — try again");
      }
    });
  }

  async function share() {
    const data = { title: item.title, text: `${item.title} — ${item.sourceName}`, url: item.sourceUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(item.sourceUrl);
        setFlash("Link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1" aria-busy={pending}>
        {KINDS.map((k) => {
          const on = mine.includes(k.kind);
          return (
            <button
              key={k.kind}
              type="button"
              aria-pressed={on}
              aria-label={k.label}
              title={k.label}
              onClick={() => toggle(k.kind)}
              className={`grid size-8 place-items-center rounded-full text-sm transition ${on ? "bg-accent-soft" : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"}`}
            >
              {k.icon}
            </button>
          );
        })}
        <button type="button" aria-label="Add a note" title="Add a note" onClick={() => setNoting((v) => !v)} className="grid size-8 place-items-center rounded-full text-sm opacity-60 grayscale hover:opacity-100 hover:grayscale-0">
          💬
        </button>
        <button type="button" aria-label="Share" title="Share" onClick={share} className="grid size-8 place-items-center rounded-full text-sm opacity-60 grayscale hover:opacity-100 hover:grayscale-0">
          ↗
        </button>
        <details className="relative">
          <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-muted hover:text-ink" aria-label="More">
            ⋯
          </summary>
          <div className="card absolute bottom-9 left-0 z-10 w-52 p-1 text-sm shadow-lg">
            <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2" onClick={() => setStory(true)}>
              ❤️ Save to Our Story
            </button>
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
              onClick={() => start(async () => setFlash((await saveToVault(item.id))?.message ?? null))}
            >
              🗝️ Add to my Knowledge Vault
            </button>
          </div>
        </details>
      </div>
      {partners.length > 0 && (
        <p className="text-xs text-muted">
          {partners.map(([slug, kinds]) => `${slug[0].toUpperCase()}${slug.slice(1)} ${kinds.includes("favorite") ? "loved" : "saved"} this`).join(" · ")}
        </p>
      )}
      {noting && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await noteOnDiscovery(item.id, note);
              setMine((m) => [...new Set([...m, "save"])]);
              setFlash(r?.message ?? null);
              setNoting(false);
            });
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field py-1.5 text-sm" placeholder="A thought about this…" aria-label="Note" />
          <button className="btn px-3 py-1.5 text-xs">Save</button>
        </form>
      )}
      {flash && (
        <p role="status" className="text-xs text-accent">
          {flash}
        </p>
      )}
      <StoryDialog item={item} open={story} onClose={() => setStory(false)} />
    </div>
  );
}
