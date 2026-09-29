"use client";

import { useEffect, useState } from "react";

const NAIROBI = 3 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Years, months, days, hours, minutes and seconds since the first day (midnight, Nairobi time). */
export function journeyParts(startedOn: string, now: number) {
  const [sy, sm, sd] = startedOn.split("-").map(Number);
  const local = new Date(now + NAIROBI);
  const [ly, lm, ld] = [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()];
  let months = (ly - sy) * 12 + (lm - sm) - (ld < sd ? 1 : 0);
  if (months < 0) months = 0;
  // The last month-versary, clamped to shorter months (the 31st → the 29th of February).
  const ay = sy + Math.floor((sm - 1 + months) / 12);
  const am = ((sm - 1 + months) % 12) + 1;
  const anchor = Date.UTC(ay, am - 1, Math.min(sd, new Date(Date.UTC(ay, am, 0)).getUTCDate()));
  const d = Math.max(0, Math.round((Date.UTC(ly, lm - 1, ld) - anchor) / 86400_000));
  return { y: Math.floor(months / 12), m: months % 12, d, h: local.getUTCHours(), min: local.getUTCMinutes(), s: local.getUTCSeconds() };
}

/**
 * The journey, counted live to the second. The first render uses the server's
 * clock (so the markup matches exactly), then it ticks with the device's.
 */
export function JourneyClock({ startedOn, serverNow }: { startedOn: string; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 1000 - (Date.now() % 1000));
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const p = journeyParts(startedOn, now);
  // Early in the journey there are no years (or months) to count yet: start from the first unit that has one.
  const date: [string, string][] = [
    [String(p.y), p.y === 1 ? "Year" : "Years"],
    [String(p.m), p.m === 1 ? "Month" : "Months"],
    [String(p.d), p.d === 1 ? "Day" : "Days"],
  ].slice(p.y > 0 ? 0 : p.m > 0 ? 1 : 2) as [string, string][];
  const cells: [string, string][] = [...date, [pad(p.h), "Hours"], [pad(p.min), "Minutes"], [pad(p.s), "Seconds"]];
  const parts = [p.y && `${p.y} year${p.y === 1 ? "" : "s"}`, (p.y || p.m) && `${p.m} month${p.m === 1 ? "" : "s"}`, `${p.d} day${p.d === 1 ? "" : "s"}`].filter(Boolean);
  return (
    <dl className="flex flex-wrap justify-center gap-y-6" aria-label={`Walking together for ${parts.join(", ")}`}>
      {cells.map(([v, label], i) => (
        <div
          key={label}
          className={`relative basis-1/3 px-2 text-center sm:flex-1 sm:basis-0 ${i % 3 !== 0 ? "border-l border-white/10" : ""} ${i > 0 && i % 3 === 0 ? "sm:border-l sm:border-white/10" : ""} ${i === date.length ? "sm:!border-[#f0dcae]/25" : ""}`}
        >
          <dd className={`num-lux text-[2.6rem] sm:text-[3.4rem] ${i >= date.length ? "text-[#e9d3a4]/90" : "text-[#f7efe1]"}`} suppressHydrationWarning>
            {v}
          </dd>
          <dt className="mt-2 text-[0.6rem] font-medium uppercase tracking-[0.3em] text-white/45">{label}</dt>
        </div>
      ))}
    </dl>
  );
}
