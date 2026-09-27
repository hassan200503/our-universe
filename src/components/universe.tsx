/**
 * The signature illustration: two worlds on orbits around one heart, joined by
 * a thread of light. Pure SVG + CSS; motion stops under prefers-reduced-motion.
 */
const STARS = Array.from({ length: 46 }, (_, i) => {
  // Deterministic "random" so server and client render identical markup.
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * 600, y: r(2) * 600, s: 0.4 + r(3) * 1.3, d: (r(4) * 4).toFixed(2) };
});

export function Universe({ left, right, size = 520 }: { left: string; right: string; size?: number }) {
  return (
    <svg viewBox="0 0 600 600" width={size} height={size} className="universe h-auto max-w-full" role="img" aria-label={`${left} and ${right}: two worlds orbiting one heart`}>
      <defs>
        <radialGradient id="u-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8fa3" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#e11d48" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="u-hassan" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="55%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </radialGradient>
        <radialGradient id="u-whitney" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="50%" stopColor="#5b9a78" />
          <stop offset="100%" stopColor="#1f3d2e" />
        </radialGradient>
        <linearGradient id="u-thread" x1="0" x2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
        <filter id="u-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="u-stars">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.s.toFixed(2)} style={{ animationDelay: `${s.d}s` }} />
        ))}
      </g>

      {/* orbits */}
      <ellipse cx="300" cy="300" rx="230" ry="230" className="u-orbit" />
      <ellipse cx="300" cy="300" rx="160" ry="160" className="u-orbit" strokeDasharray="2 8" />

      {/* the heart */}
      <circle cx="300" cy="300" r="120" fill="url(#u-core)" className="u-pulse" />
      <path
        d="M300 334c-3 0-6-1-8-3-22-19-40-34-40-55 0-15 11-26 25-26 9 0 17 4 23 12 6-8 14-12 23-12 14 0 25 11 25 26 0 21-18 36-40 55-2 2-5 3-8 3z"
        fill="#f43f5e"
        filter="url(#u-glow)"
        className="u-heart"
      />

      {/* two worlds, forever opposite, joined through the heart */}
      <g className="u-spin">
        <line x1="70" y1="300" x2="530" y2="300" stroke="url(#u-thread)" strokeWidth="1.5" strokeOpacity="0.55" />
        <g className="u-planet" style={{ transformOrigin: "70px 300px" }}>
          <circle cx="70" cy="300" r="34" fill="url(#u-hassan)" filter="url(#u-glow)" />
          <ellipse cx="70" cy="300" rx="52" ry="12" fill="none" stroke="#2dd4bf" strokeOpacity="0.7" strokeWidth="2" transform="rotate(-18 70 300)" />
          <text x="70" y="358" textAnchor="middle" className="u-label">
            {left}
          </text>
        </g>
        <g className="u-planet" style={{ transformOrigin: "530px 300px" }}>
          <circle cx="530" cy="300" r="34" fill="url(#u-whitney)" filter="url(#u-glow)" />
          <circle cx="572" cy="276" r="7" fill="#c4b5fd" />
          <text x="530" y="358" textAnchor="middle" className="u-label">
            {right}
          </text>
        </g>
      </g>
    </svg>
  );
}
