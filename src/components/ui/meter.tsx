/** The five-point self-assessment scale used on Hassan's portfolio. */
export const SCALE = [
  "",
  "Studied it and understand the shape of the problem; not shipped.",
  "Wired up and working, but untested by scale or incidents.",
  "Shipped real features with it; productive, still reaching for docs on hard cases.",
  "Load-bearing in a deployed system I built and maintain.",
  "Built it, broken it, fixed it and run it in production.",
];

export function Meter({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${level} out of 5`} title={SCALE[level]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2 w-5 rounded-full ${i <= level ? "bg-accent" : "bg-surface-2"}`} />
      ))}
    </span>
  );
}
