"use client";

import { useState, useTransition } from "react";
import { deleteRadarItem, deleteRadarLane, moveRadarItem, renameRadarLane } from "@/lib/actions/personal";

type Lane = { id: string; name: string; items: { id: string; name: string; note: string | null }[] };

export function RadarBoard({ lanes, editable }: { lanes: Lane[]; editable: boolean }) {
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-2" aria-busy={pending}>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="grid min-w-[56rem] gap-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
        {lanes.map((lane) => (
          <section
            key={lane.id}
            aria-label={lane.name}
            className="rounded-2xl border border-line bg-surface-2/60 p-3"
            onDragOver={(e) => editable && e.preventDefault()}
            onDrop={() => {
              if (!editable || !dragging) return;
              const id = dragging;
              setDragging(null);
              start(() => moveRadarItem(id, lane.id));
            }}
          >
            <header className="flex items-center justify-between gap-2">
              {editable ? (
                <input
                  defaultValue={lane.name}
                  aria-label="Lane name"
                  className="w-full bg-transparent text-xs font-bold uppercase tracking-wider text-accent outline-none focus:underline"
                  onBlur={(e) => e.target.value !== lane.name && start(() => renameRadarLane(lane.id, e.target.value))}
                />
              ) : (
                <h3 className="text-xs font-bold uppercase tracking-wider text-accent">{lane.name}</h3>
              )}
              {editable && lane.items.length === 0 && (
                <button
                  className="text-xs text-muted hover:text-red-600"
                  aria-label={`Remove lane ${lane.name}`}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteRadarLane(lane.id);
                      setError(r?.error ?? null);
                    })
                  }
                >
                  ✕
                </button>
              )}
            </header>
            <ul className="mt-3 min-h-16 space-y-2">
              {lane.items.map((item) => (
                <li
                  key={item.id}
                  draggable={editable}
                  onDragStart={() => setDragging(item.id)}
                  className={`card p-2.5 text-sm ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <p className="font-semibold">{item.name}</p>
                  {item.note && <p className="mt-0.5 text-xs text-muted">{item.note}</p>}
                  {editable && (
                    <div className="mt-2 flex items-center gap-2">
                      {/* Keyboard- and touch-friendly alternative to dragging. */}
                      <select
                        aria-label={`Move ${item.name}`}
                        value={lane.id}
                        onChange={(e) => start(() => moveRadarItem(item.id, e.target.value))}
                        className="min-w-0 flex-1 rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
                      >
                        {lanes.map((l) => (
                          <option key={l.id} value={l.id}>
                            → {l.name}
                          </option>
                        ))}
                      </select>
                      <button aria-label={`Remove ${item.name}`} className="text-xs text-muted hover:text-red-600" onClick={() => start(() => deleteRadarItem(item.id))}>
                        ✕
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
