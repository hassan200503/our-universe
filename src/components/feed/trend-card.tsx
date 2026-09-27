"use client";

import Link from "next/link";
import type { TrendCard as Card } from "@/lib/trends/query";
import { TOPICS } from "@/lib/trends/topics";
import { ago, day } from "@/lib/ui/time";
import { Reactions } from "./reactions";
import { SmartImage, SoundPlayer, VideoPlayer } from "./media";

const TOPIC_WORLD: Record<string, string> = {
  software: "hassan",
  technology: "hassan",
  philosophy: "hassan",
  biotech: "whitney",
  birds: "whitney",
  knitting: "whitney",
  environment: "whitney",
  nature: "us",
};

const isLiving = (item: Card) => item.contentType === "observation" || item.contentType === "sound";

/** Shown only while an item has no picture yet; the ingest keeps looking for one. */
function TopicArt({ item }: { item: Card }) {
  const t = TOPICS[item.topic];
  return (
    <div className="relative flex aspect-[16/9] items-end overflow-hidden rounded-t-[17px] bg-accent-soft p-4" aria-hidden>
      <div className="absolute -right-6 -top-8 text-[7rem] leading-none opacity-25 blur-[1px]">{t?.emoji}</div>
      <div className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_100%,var(--glow),transparent_70%)]" />
      <span className="relative font-display text-sm font-semibold text-accent">{item.category}</span>
    </div>
  );
}

function Photo({ item, priority }: { item: Card; priority?: boolean }) {
  const living = isLiving(item);
  const alt = living ? `${item.extra?.commonName ?? item.title}${item.extra?.place ? `, ${item.extra.place}` : ""}` : "";
  return (
    <figure className={`relative overflow-hidden rounded-t-[17px] bg-surface-2 ${living ? "aspect-[4/3]" : "aspect-[16/9]"}`}>
      <div className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden />
      <SmartImage
        src={item.imageUrl!}
        priority={priority}
        alt={alt}
        className="relative size-full object-cover"
        fallback={
          <div className="absolute inset-0">
            <TopicArt item={item} />
          </div>
        }
      />
      {(item.imageCredit || item.imageLicense) && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-1.5 pt-6 text-[0.68rem] text-white/90">
          {living ? item.imageCredit : `Image: ${item.imageCredit}`}
          {item.imageLicense && item.imageCredit && !item.imageCredit.includes(item.imageLicense) ? ` · ${item.imageLicense}` : ""}
        </figcaption>
      )}
    </figure>
  );
}

function Visual({ item, priority }: { item: Card; priority?: boolean }) {
  const yt = item.extra?.youtubeId;
  if (yt) return <VideoPlayer youtubeId={yt} title={item.title} thumb={item.imageUrl ?? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} />;
  if (item.imageUrl) return <Photo item={item} priority={priority} />;
  return <TopicArt item={item} />;
}

function Freshness({ item }: { item: Card }) {
  if (isLiving(item)) {
    return (
      <span suppressHydrationWarning>
        {item.extra?.observedOn ? `Recorded ${day(item.extra.observedOn)} · ` : ""}shared {ago(item.publishedAt)}
      </span>
    );
  }
  return (
    <span suppressHydrationWarning title={`Retrieved ${day(item.fetchedAt)}`}>
      <time dateTime={item.publishedAt}>{ago(item.publishedAt)}</time> · Published {day(item.publishedAt)}
    </span>
  );
}

function LivingDetails({ item }: { item: Card }) {
  const x = item.extra ?? {};
  return (
    <>
      {x.scientificName && <p className="mt-0.5 text-sm italic text-muted">{x.scientificName}</p>}
      {x.audioUrl && (
        <div className="mt-3">
          <SoundPlayer id={item.id} src={x.audioUrl} label={`${item.title} — real recording`} credit={[x.audioCredit, x.audioLicense].filter(Boolean).join(" · ")} />
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {x.place && (
          <>
            <dt className="text-muted">Location</dt>
            <dd>{x.place}</dd>
          </>
        )}
        {x.conservationStatus && (
          <>
            <dt className="text-muted">Status</dt>
            <dd title={x.conservationAuthority}>{x.conservationStatus}</dd>
          </>
        )}
      </dl>
      {x.fact && (
        <p className="mt-3 line-clamp-5 text-sm leading-relaxed">
          {x.fact}{" "}
          {x.factUrl && (
            <a href={x.factUrl} target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-dotted">
              — Wikipedia
            </a>
          )}
        </p>
      )}
    </>
  );
}

const ORIGINAL_LABEL: Record<string, string> = {
  observation: "View on iNaturalist",
  sound: "View on iNaturalist",
  video: "Watch on YouTube",
  community: "See the post",
};

export function TrendCardView({ item, compact = false, priority = false }: { item: Card; compact?: boolean; priority?: boolean }) {
  const t = TOPICS[item.topic];
  const living = isLiving(item);
  return (
    <article data-world={TOPIC_WORLD[item.topic] ?? "us"} className="feed-card card flex flex-col overflow-hidden rise">
      {!compact && <Visual item={item} priority={priority} />}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span aria-hidden>{t?.emoji}</span> {living ? item.category : t?.label}
          </span>
          {!living && <span className="text-xs text-muted">{item.category}</span>}
        </div>
        <h3 className="font-display mt-2 text-lg font-semibold leading-snug">
          <Link href={`/discover/item/${item.id}`} className="hover:underline">
            {item.title}
          </Link>
        </h3>
        {living ? <LivingDetails item={item} /> : item.summary && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted">{item.summary}</p>}
        <div className="mt-auto pt-4">
          <p className="text-xs text-muted">
            <span className="font-semibold text-ink">{item.sourceName}</span>
            {item.author && !living ? ` · ${item.author}` : ""}
            <br />
            <Freshness item={item} />
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Reactions item={item} />
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent hover:underline">
              {ORIGINAL_LABEL[item.contentType] ?? "Read original"} →
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
