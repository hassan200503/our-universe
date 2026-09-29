"use client";

import Link from "next/link";
import { useTransition } from "react";
import { sendNudge } from "@/lib/actions/together";
import { Avatar } from "@/components/avatar";
import { useCall } from "@/components/call/call-provider";
import { IconHeadphones, IconMessage, IconPhone, IconVideo } from "@/components/icons";
import { usePartners } from "@/components/me-context";
import { usePulse } from "@/components/pulse";

/** Appears when your partner is online right now — the moment to do something together. */
export function TogetherNow() {
  const partner = usePartners()[0];
  const { data } = usePulse();
  const call = useCall();
  const [pending, start] = useTransition();
  if (!partner || !data) return null;
  const p = data.partners.find((x) => x.slug === partner.slug);
  if (!p?.online) return null;
  const first = partner.displayName.split(" ")[0];
  const listening = p.place === "room" && data.room?.playing;
  const icon = "grid size-10 place-items-center rounded-full border border-line bg-surface text-ink transition hover:border-gold hover:bg-gold-soft";
  return (
    <div className="tile rise flex flex-wrap items-center gap-4 p-4 sm:p-5">
      <Avatar name={partner.displayName} url={partner.avatarUrl} theme={partner.theme} size={52} online />
      <div className="min-w-0 flex-1">
        <p className="font-lux text-2xl font-medium leading-tight">{first} is here right now</p>
        <p className="mt-0.5 text-sm text-muted">
          {listening
            ? `Listening to “${data.room?.title ?? "something"}” in the Together room.`
            : p.place === "room"
              ? "Waiting in the Together room."
              : p.place === "chat"
                ? "In your messages."
                : "A perfect moment to talk, or to listen to something together."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/together/chat" className={icon} aria-label={`Message ${first}`} title="Message">
          <IconMessage size={18} />
        </Link>
        <button type="button" className={icon} aria-label={`Voice call ${first}`} title="Voice call" onClick={() => call?.start("audio")}>
          <IconPhone size={17} />
        </button>
        <button type="button" className={icon} aria-label={`Video call ${first}`} title="Video call" onClick={() => call?.start("video")}>
          <IconVideo size={18} />
        </button>
        {p.place === "room" ? (
          <Link href="/together" className="btn ml-1" data-world="us">
            <IconHeadphones size={16} /> Join {first}
          </Link>
        ) : (
          <button disabled={pending} className="btn ml-1" data-world="us" onClick={() => start(async () => void (await sendNudge("invite")))}>
            <IconHeadphones size={16} /> Invite to listen
          </button>
        )}
      </div>
    </div>
  );
}
