/** Each world's signature mark, drawn in its own accent colours. */
export function WorldEmblem({ theme }: { theme: string }) {
  if (theme === "hassan") {
    return (
      <svg viewBox="0 0 200 200" className="size-40 sm:size-48" aria-hidden>
        <circle cx="100" cy="100" r="78" fill="none" stroke="var(--accent)" strokeOpacity=".25" />
        <circle cx="100" cy="100" r="56" fill="none" stroke="var(--accent-2)" strokeOpacity=".35" strokeDasharray="3 6" />
        <circle cx="100" cy="100" r="30" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity=".5" />
        <text x="100" y="108" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="22" fontWeight="700" fill="var(--accent)">
          {"</>"}
        </text>
        <circle cx="178" cy="100" r="6" fill="var(--accent)" />
        <circle cx="60" cy="52" r="4" fill="var(--accent-2)" />
        <circle cx="44" cy="140" r="3" fill="var(--accent)" fillOpacity=".6" />
      </svg>
    );
  }
  if (theme === "whitney") {
    // A DNA helix growing a leaf, with a small bird: biotech, nature, birds.
    const rungs = Array.from({ length: 9 }, (_, i) => {
      const y = 24 + i * 18;
      const x = 100 + Math.sin(i * 0.8) * 34;
      const x2 = 200 - x;
      return { y, x, x2 };
    });
    return (
      <svg viewBox="0 0 200 200" className="size-40 sm:size-48" aria-hidden>
        {rungs.map((r, i) => (
          <g key={i}>
            <line x1={r.x.toFixed(1)} y1={r.y} x2={r.x2.toFixed(1)} y2={r.y} stroke="var(--accent-2)" strokeOpacity=".45" strokeWidth="2" />
            <circle cx={r.x.toFixed(1)} cy={r.y} r="4.5" fill="var(--accent)" />
            <circle cx={r.x2.toFixed(1)} cy={r.y} r="4.5" fill="var(--accent-2)" />
          </g>
        ))}
        <path d="M100 24c20-22 52-18 60-4-18 14-44 16-60 4z" fill="var(--accent)" fillOpacity=".85" />
        <path d="M150 170c6-8 16-9 22-4-4 1-6 3-7 6 5 0 8 2 9 5-9 2-18 0-24-7z" fill="var(--accent-2)" />
      </svg>
    );
  }
  return null;
}
