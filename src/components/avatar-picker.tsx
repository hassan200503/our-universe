"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removeAvatar, setAvatar } from "@/lib/actions/media";
import { uploadAvatar } from "@/lib/media/client-upload";
import { Avatar } from "./avatar";

export function AvatarPicker({ name, url, theme, enabled }: { name: string; url: string | null; theme: string; enabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function pick(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStatus("Uploading…");
    try {
      const path = await uploadAvatar(file);
      const r = await setAvatar(path);
      setStatus(r.ok ? "Saved — it shows for both of you ❤️" : (r.error ?? "Couldn't save"));
      if (r.ok) router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
      setPreview(null);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} url={preview ?? url} theme={theme} size={88} ring />
      <div>
        <p className="font-semibold">Profile picture</p>
        {enabled ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn px-4 py-1.5 text-sm" onClick={() => input.current?.click()}>
              {url ? "Change photo" : "Add a photo"}
            </button>
            {url && (
              <button
                type="button"
                disabled={pending}
                className="btn btn-ghost px-4 py-1.5 text-sm"
                onClick={() =>
                  start(async () => {
                    await removeAvatar();
                    setPreview(null);
                    router.refresh();
                  })
                }
              >
                Remove
              </button>
            )}
            <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted">Available once photo storage is switched on.</p>
        )}
        {status && (
          <p role="status" className="mt-1 text-xs text-accent">
            {status}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Tip: in the Gallery, any photo can become your profile picture.</p>
      </div>
    </div>
  );
}
