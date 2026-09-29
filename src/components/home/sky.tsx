/**
 * The night sky of the home stage: a field of stars (fixed positions, so the
 * server and browser draw the same sky) and two stars bound on one orbit,
 * trailing light toward each other. Pure SVG and CSS; still for anyone who
 * prefers reduced motion.
 */
const rand = (i: number, n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;

export function Starfield({ count = 140 }: { count?: number }) {
  return (
    <svg className="stars pointer-events-none absolute inset-0 -z-10 size-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1600 900" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const big = rand(i, 3) > 0.93;
        return (
          <circle
            key={i}
            cx={(rand(i, 1) * 1600).toFixed(1)}
            cy={(rand(i, 2) * 900).toFixed(1)}
            r={(big ? 1.3 + rand(i, 4) : 0.35 + rand(i, 4) * 0.8).toFixed(2)}
            opacity={(0.25 + rand(i, 5) * 0.6).toFixed(2)}
            className={rand(i, 6) > 0.6 ? "tw" : undefined}
            style={{ animationDelay: `${(rand(i, 7) * 5).toFixed(2)}s`, animationDuration: `${(3 + rand(i, 8) * 5).toFixed(2)}s` }}
          />
        );
      })}
    </svg>
  );
}

export function Orbit({ left, right, className = "" }: { left: string; right: string; className?: string }) {
  return (
    <svg viewBox="36 36 488 488" className={`orbit ${className}`} role="img" aria-label={`${left} and ${right}: two stars on one orbit`}>
      <defs>
        <radialGradient id="o-core">
          <stop offset="0" stopColor="#fff3d6" stopOpacity="0.9" />
          <stop offset="0.25" stopColor="#e8c88c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e8c88c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="o-a" cx="38%" cy="35%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c9c6ff" />
          <stop offset="1" stopColor="#5b55d6" />
        </radialGradient>
        <radialGradient id="o-b" cx="38%" cy="35%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#cfeede" />
          <stop offset="1" stopColor="#4f8f6c" />
        </radialGradient>
        <radialGradient id="o-halo">
          <stop offset="0" stopColor="#fff6e2" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6e2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="o-trail-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f0d9a6" stopOpacity="0" />
          <stop offset="1" stopColor="#f0d9a6" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="o-trail-b" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#f0d9a6" stopOpacity="0" />
          <stop offset="1" stopColor="#f0d9a6" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Rings of the system */}
      <g fill="none" stroke="#f0dcae">
        <circle cx="280" cy="280" r="238" strokeOpacity="0.08" />
        <circle className="orbit-dash" cx="280" cy="280" r="205" strokeOpacity="0.2" strokeDasharray="1 7" strokeLinecap="round" />
        <circle cx="280" cy="280" r="160" strokeOpacity="0.18" />
        <circle cx="280" cy="280" r="96" strokeOpacity="0.07" />
      </g>
      <circle cx="280" cy="280" r="90" fill="url(#o-core)" className="orbit-breathe" />
      <circle cx="280" cy="280" r="2.4" fill="#fff4dc" />

      {/* The pair, turning together around the centre they share */}
      <g className="orbit-spin">
        <path d="M122.4 307.8 A160 160 0 0 1 418.6 200" fill="none" stroke="url(#o-trail-a)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M437.6 252.2 A160 160 0 0 1 141.4 360" fill="none" stroke="url(#o-trail-b)" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="418.6" cy="200" r="42" fill="url(#o-halo)" />
        <circle cx="418.6" cy="200" r="15" fill="url(#o-a)" />
        <circle cx="141.4" cy="360" r="42" fill="url(#o-halo)" />
        <circle cx="141.4" cy="360" r="15" fill="url(#o-b)" />
      </g>
    </svg>
  );
}
