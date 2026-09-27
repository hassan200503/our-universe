"use client";

import Link from "next/link";
import { useTransition } from "react";
import { sendNudge } from "@/lib/actions/together";
import { Avatar } from "@/components/avatar";
import { usePartners } from "@/components/me-context";
import { usePulse } from "@/components/pulse";

/** Appears when your partner is online right now — the moment to do something together. */
export function TogetherNow() {
  const partner = usePartners()[0];
  const { data } = usePulse();
  const [pending, start] = useTransition();
  if (!partner || !data) return null;
  const p = data.partners.find((x) => x.slug === partner.slug);
  if (!p?.online) return null;
  const first = partner.displayName.split(" ")[0];
  const listening = p.place === "room" && data.room?.playing;
  return (
    <div data-world="us" className="card-glow rise flex flex-wrap items-center gap-4 p-4">
      <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={48} online />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {first} is online right now 💚
        </p>
        <p className="text-sm text-muted">
          {listening ? `${first} is listening to “${data.room?.title ?? "something"}” in the Together room.` : p.place === "room" ? `${first} is waiting in the Together room.` : "A perfect moment to listen to a song or watch something together."}
        </p>
      </div>
      {p.place === "room" ? (
        <Link href="/together" className="btn">
          🎧 Join {first}
        </Link>
      ) : (
        <div className="flex gap-2">
          <button disabled={pending} className="btn" onClick={() => start(async () => void (await sendNudge("invite")))}>
            🎧 Invite to listen
          </button>
          <button disabled={pending} className="btn btn-ghost" onClick={() => start(async () => void (await sendNudge("nudge")))}>
            ❤️
          </button>
        </div>
      )}
    </div>
  );
}
