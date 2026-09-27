"use client";

import { prepareUpload, saveUploaded } from "@/lib/actions/media";

export type Kind = "photo" | "video" | "song";

export function kindOf(file: File): Kind | null {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "song";
  if (/\.(heic|heif)$/i.test(file.name)) return "photo";
  return null;
}

// ─── Browser-side processing ──────────────────────────────────────────────

async function toCanvasBlob(source: CanvasImageSource, w: number, h: number, maxEdge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(source, 0, 0, width, height);
  const blob =
    (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality))) ??
    (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality)));
  if (!blob) throw new Error("Couldn't process that image");
  return { blob, width, height };
}

/** A photo becomes a sharp 2560px WebP plus a 480px thumbnail for the grid. */
export async function processPhoto(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("This photo format isn't supported by your browser. Try a JPEG or PNG.");
  // GIFs keep their animation: upload the original, only the thumbnail is generated.
  const full = file.type === "image/gif" ? { blob: file as Blob, width: bitmap.width, height: bitmap.height } : await toCanvasBlob(bitmap, bitmap.width, bitmap.height, 2560, 0.86);
  const thumb = await toCanvasBlob(bitmap, bitmap.width, bitmap.height, 480, 0.74);
  bitmap.close();
  return { full, thumb };
}

/** Reads a video's size and duration, and captures a poster frame for the grid. */
export async function processVideo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("This video format can't be read by your browser. MP4 works everywhere."));
    });
    const duration = video.duration;
    video.currentTime = Math.min(1.2, (duration || 2) / 3);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      setTimeout(resolve, 4000);
    });
    const thumb = video.videoWidth ? await toCanvasBlob(video, video.videoWidth, video.videoHeight, 640, 0.74) : null;
    return { width: video.videoWidth || null, height: video.videoHeight || null, duration: Number.isFinite(duration) ? duration : null, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function audioDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    return await new Promise<number | null>((resolve) => {
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : null);
      a.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 5000);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Transport ────────────────────────────────────────────────────────────

/** Sends one object to storage (Vercel Blob in production, our dev route locally). */
export async function putObject(mode: "blob" | "local", path: string, body: Blob, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  if (mode === "blob") {
    const { upload } = await import("@vercel/blob/client");
    await upload(path, body, {
      access: "private",
      handleUploadUrl: "/api/media/upload",
      contentType: body.type || undefined,
      multipart: body.size > 8 * 1024 * 1024,
      onUploadProgress: (e) => onProgress(e.percentage),
      abortSignal: signal,
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/media/local?path=${encodeURIComponent(path)}`);
    xhr.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

export type UploadMeta = { title?: string; artist?: string; caption?: string; takenOn?: string };

/** The whole pipeline for one file. Returns the new gallery item id. */
export async function uploadToGallery(file: File, meta: UploadMeta, onProgress: (pct: number, stage: string) => void, signal?: AbortSignal): Promise<string> {
  const kind = kindOf(file);
  if (!kind) throw new Error("Only photos, videos and audio can go in the gallery.");

  onProgress(2, "Preparing");
  let body: Blob = file;
  let thumb: Blob | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;

  if (kind === "photo") {
    const p = await processPhoto(file);
    body = p.full.blob;
    thumb = p.thumb.blob;
    width = p.full.width;
    height = p.full.height;
  } else if (kind === "video") {
    const v = await processVideo(file);
    thumb = v.thumb?.blob ?? null;
    width = v.width;
    height = v.height;
    duration = v.duration;
  } else {
    duration = await audioDuration(file);
  }

  const mime = body.type || file.type;
  const prep = await prepareUpload(kind, mime, body.size);
  if (!prep.ok) throw new Error(prep.error);

  const thumbShare = thumb ? 8 : 0;
  if (thumb && prep.thumbPath) await putObject(prep.mode, prep.thumbPath, thumb, (p) => onProgress(3 + (p * thumbShare) / 100, "Uploading"), signal);
  await putObject(prep.mode, prep.path, body, (p) => onProgress(3 + thumbShare + (p * (95 - thumbShare)) / 100, "Uploading"), signal);

  onProgress(97, "Saving");
  const res = await saveUploaded({
    kind,
    path: prep.path,
    thumbPath: thumb ? prep.thumbPath : null,
    mime,
    width,
    height,
    durationSec: duration,
    title: meta.title ?? (kind === "song" ? file.name.replace(/\.[^.]+$/, "") : null),
    artist: meta.artist ?? null,
    caption: meta.caption ?? null,
    takenOn: meta.takenOn ?? (file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : null),
  });
  if (!res.ok || !res.id) throw new Error(res.error ?? "Couldn't save");
  onProgress(100, "Done");
  return res.id;
}

/** A square, centred profile picture at 512px. */
export async function uploadAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("Choose a JPEG, PNG or WebP photo.");
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  bitmap.close();
  const blob = (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86))) ?? (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88)));
  if (!blob) throw new Error("Couldn't process that photo");
  const prep = await prepareUpload("avatar", blob.type, blob.size);
  if (!prep.ok) throw new Error(prep.error);
  await putObject(prep.mode, prep.path, blob, () => {});
  return prep.path;
}
