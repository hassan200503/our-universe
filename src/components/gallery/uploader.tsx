"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionState, useEffect, useRef, useState } from "react";
import { addYouTube } from "@/lib/actions/media";
import { kindOf, uploadToGallery } from "@/lib/media/client-upload";

type Job = { key: string; file: File; pct: number; stage: string; error?: string; done?: boolean; ctrl: AbortController };

const CONCURRENCY = 2;

export function Uploader({ enabled, disabledReason }: { enabled: boolean; disabledReason?: string }) {
  const qc = useQueryClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [caption, setCaption] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(0);
  const queue = useRef<Job[]>([]);
  const [yt, ytAction, ytPending] = useActionState(addYouTube, null);

  useEffect(() => {
    if (yt?.ok) qc.invalidateQueries({ queryKey: ["gallery"] });
  }, [yt, qc]);

  // Warn before closing the tab mid-upload.
  useEffect(() => {
    const busy = jobs.some((j) => !j.done && !j.error);
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [jobs]);

  const update = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  function pump() {
    while (running.current < CONCURRENCY && queue.current.length) {
      const job = queue.current.shift()!;
      running.current++;
      uploadToGallery(job.file, { caption: caption || undefined }, (pct, stage) => update(job.key, { pct, stage }), job.ctrl.signal)
        .then(() => {
          update(job.key, { done: true, pct: 100, stage: "Shared ❤️" });
          qc.invalidateQueries({ queryKey: ["gallery"] });
        })
        .catch((e) => update(job.key, { error: job.ctrl.signal.aborted ? "Cancelled" : e instanceof Error ? e.message : "Upload failed" }))
        .finally(() => {
          running.current--;
          pump();
        });
    }
  }

  function add(files: FileList | File[]) {
    const list = [...files].filter((f) => kindOf(f));
    const skipped = [...files].length - list.length;
    const newJobs = list.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, pct: 0, stage: "Waiting", ctrl: new AbortController() }));
    setJobs((js) => [...js.filter((j) => !j.done), ...newJobs, ...(skipped ? [{ key: `skip-${Math.random()}`, file: new File([], `${skipped} file(s)`), pct: 0, stage: "", error: "Skipped — only photos, videos and audio", ctrl: new AbortController() }] : [])]);
    queue.current.push(...newJobs);
    pump();
  }

  if (!enabled) {
    return (
      <div className="card p-5 text-sm">
        <p className="font-semibold">Uploads are almost ready</p>
        <p className="mt-1 text-muted">{disabledReason}</p>
        <p className="mt-2 text-muted">Meanwhile you can already add songs and videos from YouTube below.</p>
        <YouTubeForm action={ytAction} pending={ytPending} state={yt} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={`card-glow relative flex flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center transition ${drag ? "scale-[1.01] border-accent bg-accent-soft" : "border-transparent"}`}
      >
        <span className="text-4xl" aria-hidden>
          📸🎬🎵
        </span>
        <p className="font-display text-xl font-semibold">Share photos, videos & songs</p>
        <p className="text-sm text-muted">Drop them here or choose from your phone. They appear for both of you instantly.</p>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption for this batch (optional)"
          className="field mt-2 max-w-md text-sm"
          aria-label="Caption"
        />
        <button type="button" className="btn mt-1 px-6 py-3" onClick={() => input.current?.click()}>
          Choose files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-[0.7rem] text-muted">Photos up to 25 MB · videos up to 500 MB · audio up to 60 MB. Photos are resized for you.</p>
      </div>

      <div className="card p-5">
        <p className="font-semibold">🎶 Add a song or video from YouTube</p>
        <p className="mt-1 text-xs text-muted">Full songs, music videos, anything on YouTube. Nothing is uploaded, so there&apos;s no size limit.</p>
        <YouTubeForm action={ytAction} pending={ytPending} state={yt} />
      </div>

      {jobs.length > 0 && (
        <ul className="space-y-2 lg:col-span-2" aria-live="polite">
          {jobs.map((j) => (
            <li key={j.key} className="card flex items-center gap-3 px-4 py-2.5 text-sm">
              <span aria-hidden>{j.file.type.startsWith("video") ? "🎬" : j.file.type.startsWith("audio") ? "🎵" : "🖼️"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{j.file.name}</p>
                {j.error ? (
                  <p className="text-xs text-red-600">{j.error}</p>
                ) : (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(j.pct)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full rounded-full transition-all ${j.done ? "bg-emerald-500" : "bg-accent"}`} style={{ width: `${Math.max(2, j.pct)}%` }} />
                  </div>
                )}
              </div>
              <span className="w-24 text-right text-xs text-muted">{j.error ? "" : j.done ? j.stage : `${j.stage} ${Math.round(j.pct)}%`}</span>
              {!j.done && !j.error && (
                <button className="text-xs text-muted hover:text-red-600" onClick={() => j.ctrl.abort()}>
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function YouTubeForm({ action, pending, state }: { action: (fd: FormData) => void; pending: boolean; state: { ok?: boolean; error?: string; message?: string } | null }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="mt-3 space-y-2">
      <input name="url" required placeholder="Paste a YouTube or YouTube Music link" className="field text-sm" aria-label="YouTube link" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="kind" value="song" defaultChecked /> 🎵 Song
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="kind" value="video" /> 🎬 Video
        </label>
      </div>
      <input name="caption" placeholder="Why this one? (optional)" className="field text-sm" aria-label="Note" />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-accent">{state.message}</p>}
      </div>
    </form>
  );
}
