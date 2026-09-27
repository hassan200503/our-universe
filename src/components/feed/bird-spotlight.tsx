"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { FeedPage } from "@/lib/trends/query";
import { TrendCardView } from "./trend-card";

/** One bird at a time, drawn from real recent sightings in Kenya. */
export function BirdSpotlight() {
  const [exclude, setExclude] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const q = useQuery({
    queryKey: ["bird-spotlight", n],
    queryFn: async (): Promise<FeedPage> => {
      const res = await fetch(`/api/trends?feed=random&topic=birds${exclude ? `&exclude=${exclude}` : ""}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: Infinity,
  });
  const bird = q.data?.items[0];
  return (
    <section aria-label="Bird spotlight" className="mb-8 grid items-center gap-6 md:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="eyebrow">Bird spotlight</p>
        <h2 className="font-display mt-2 text-2xl font-semibold">A bird someone saw in Kenya recently</h2>
        <p className="mt-2 text-muted">
          Research-grade sightings from iNaturalist naturalists, photographed under Creative Commons licences, with a short fact from Wikipedia.
        </p>
        <button
          className="btn mt-4"
          onClick={() => {
            setExclude(bird?.id ?? null);
            setN((v) => v + 1);
          }}
          disabled={q.isFetching}
        >
          🐦 {q.isFetching ? "Looking…" : "Discover another"}
        </button>
      </div>
      <div className="w-full max-w-md md:justify-self-end">
        {bird ? (
          <TrendCardView key={bird.id} item={bird} />
        ) : q.isError ? (
          <p className="card p-6 text-muted">Some discoveries are temporarily unavailable. Your saved content is still here.</p>
        ) : (
          <div className="card aspect-[4/5] animate-pulse" />
        )}
      </div>
    </section>
  );
}
