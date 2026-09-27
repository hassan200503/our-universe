"use client";

import { useEffect, useRef, useState } from "react";

/** Longest edge after compression. Keeps photos sharp on phones while ~200 KB each. */
const MAX_EDGE = 1600;

async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
  if (blob) return { blob, width, height };
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!jpeg) throw new Error("Couldn't process that image");
  return { blob: jpeg, width, height };
}

/**
 * Choose a photo → compressed in the browser → uploaded → its private URL is
 * put in a hidden input named `name`, so the surrounding form just submits it.
 */
export function PhotoPicker({ name = "photoUrl" }: { name?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  // Clear the preview when the surrounding form is reset after a successful save.
  useEffect(() => {
    const form = hidden.current?.form ?? null;
    if (!form) return;
    const clear = () => setUrl(null);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  async function pick(file: File | undefined) {
    if (!file) return;
    setState("working");
    setError(null);
    try {
      const { blob, width, height } = await compress(file);
      const fd = new FormData();
      fd.set("file", new File([blob], "photo", { type: blob.type }));
      fd.set("width", String(width));
      fd.set("height", String(height));
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setUrl(json.url);
      setState("idle");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div>
      <input ref={hidden} type="hidden" name={name} value={url ?? ""} />
      {url ? (
        <div className="relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Chosen photo" className="max-h-56 w-full object-cover" />
          <button
            type="button"
            onClick={() => {
              setUrl(null);
              if (input.current) input.current.value = "";
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur"
          >
            Change
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted transition hover:border-accent hover:text-ink">
          <span className="text-2xl" aria-hidden>
            {state === "working" ? "⏳" : "📷"}
          </span>
          {state === "working" ? "Preparing your photo…" : "Add a photo"}
          <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={state === "working"} />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
