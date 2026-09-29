import { useId } from "react";

/**
 * Line icons drawn on a 24px grid with one stroke weight, so every control in
 * the app reads as one family. Decorative by default; pass a `title` when an
 * icon is the only label.
 */
type P = { className?: string; size?: number; title?: string; strokeWidth?: number };

function Svg({ className = "", size = 20, title, strokeWidth = 1.6, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M5.5 9v10.5h13V9" />
    <path d="M10 19.5v-5h4v5" />
  </Svg>
);
export const IconHeart = (p: P) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
  </Svg>
);
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-4.8-4.8L6 19.5" />
  </Svg>
);
export const IconHeadphones = (p: P) => (
  <Svg {...p}>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3.5" y="14" width="4" height="6" rx="1.6" />
    <rect x="16.5" y="14" width="4" height="6" rx="1.6" />
  </Svg>
);
export const IconCompass = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const IconMessage = (p: P) => (
  <Svg {...p}>
    <path d="M20.5 11.6c0 4.3-3.8 7.6-8.5 7.6-1.2 0-2.3-.2-3.3-.6L4 20l1.3-3.7A7.2 7.2 0 0 1 3.5 11.6C3.5 7.3 7.3 4 12 4s8.5 3.3 8.5 7.6Z" />
  </Svg>
);
export const IconPhone = (p: P) => (
  <Svg {...p}>
    <path d="M5 4.5h3l1.5 4-2 1.3a10 10 0 0 0 6.7 6.7l1.3-2 4 1.5v3A1.5 1.5 0 0 1 18 20.5 15.5 15.5 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5Z" />
  </Svg>
);
export const IconPhoneOff = (p: P) => (
  <Svg {...p}>
    <path d="M3.3 13.6c-.5-.5-.5-1.3 0-1.8a12.3 12.3 0 0 1 17.4 0c.5.5.5 1.3 0 1.8l-1.7 1.7a1 1 0 0 1-1.2.2l-2.4-1.2a1 1 0 0 1-.6-.9v-1.9a9.6 9.6 0 0 0-5.6 0v1.9a1 1 0 0 1-.6.9l-2.4 1.2a1 1 0 0 1-1.2-.2Z" />
  </Svg>
);
export const IconVideo = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="12.5" height="11" rx="2.5" />
    <path d="m15.5 10.5 5.5-3v9l-5.5-3" />
  </Svg>
);
export const IconVideoOff = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 13.5v1.5a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 2.5-2.5h1" />
    <path d="M10 6.5h3a2.5 2.5 0 0 1 2.5 2.5v1.5l5.5-3v9" />
    <path d="m3 3 18 18" />
  </Svg>
);
export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Svg>
);
export const IconMicOff = (p: P) => (
  <Svg {...p}>
    <path d="M15 10.5V6.5a3 3 0 0 0-5.7-1.3M9 9v2.5a3 3 0 0 0 4.6 2.5" />
    <path d="M18.5 11.5a6.5 6.5 0 0 1-1 3.5M5.5 11.5a6.5 6.5 0 0 0 10 5.5M12 18v2.5M3 3l18 18" />
  </Svg>
);
export const IconFlip = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5V7a2 2 0 0 1 2-2h2.5L10 3.5h4L15.5 5H18a2 2 0 0 1 2 2v1.5" />
    <path d="M20 15.5V17a2 2 0 0 1-2 2h-2.5L14 20.5h-4L8.5 19H6a2 2 0 0 1-2-2v-1.5" />
    <path d="m7 11-3 2-1.5-3M17 13l3-2 1.5 3" />
  </Svg>
);
export const IconSpeaker = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
export const IconReply = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 6 4 11.5 9.5 17" />
    <path d="M4.5 11.5H14a6 6 0 0 1 6 6V19" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6" />
    <path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7" />
  </Svg>
);
export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconChecks = (p: P) => (
  <Svg {...p}>
    <path d="m2.5 12.5 4.5 4.5 9.5-9.5" />
    <path d="m11.5 16 1 1 9.5-9.5" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m5 9 7 7 7-7" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Svg>
);
export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12 3 4.5l18 7.5-18 7.5L4.5 12Zm0 0h7" />
  </Svg>
);
export const IconMinimize = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 4.5v5h-5M14.5 19.5v-5h5M4.5 4.5l5 5M19.5 19.5l-5-5" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5v15M6 13.5l6 6 6-6" />
  </Svg>
);
export const IconSmile = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14a4.5 4.5 0 0 0 7 0M9.3 9.8h.01M14.7 9.8h.01" strokeWidth={2} />
  </Svg>
);
export const IconArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8.5 7H17v8.5" />
  </Svg>
);
export const IconArrowDownLeft = (p: P) => (
  <Svg {...p}>
    <path d="M17 7 7 17M15.5 17H7V8.5" />
  </Svg>
);
export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c.6 4.2 2.3 6.4 6.5 8.5-4.2 2.1-5.9 4.3-6.5 8.5-.6-4.2-2.3-6.4-6.5-8.5 4.2-2.1 5.9-4.3 6.5-8.5Z" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={2.6} />
  </Svg>
);
export const IconNext = (p: P) => (
  <Svg {...p}>
    <path d="M6 6v12l9-6-9-6Z" fill="currentColor" />
    <path d="M18 6v12" strokeWidth={2.2} />
  </Svg>
);
export const IconSignal = ({ bars = 3, ...p }: P & { bars?: 0 | 1 | 2 | 3 }) => (
  <Svg {...p}>
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${6 + i * 5} ${18 - i * 4}V19`} strokeWidth={2.4} opacity={i < bars ? 1 : 0.28} />
    ))}
  </Svg>
);

/** The mark: two stars on one orbit, each trailing light toward the other. */
export function Monogram({ size = 26, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="10 10 44 44" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--gold)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="var(--gold)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
        <radialGradient id={`${id}s`}>
          <stop offset="0" stopColor="#fff4dc" />
          <stop offset="0.6" stopColor="#e7c68a" />
          <stop offset="1" stopColor="#b98a4a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="17" fill="none" stroke="var(--gold)" strokeOpacity="0.3" strokeWidth="1.1" />
      <path d="M15.26 34.95 A17 17 0 0 1 46.72 23.5" fill="none" stroke={`url(#${id}a)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M48.74 29.05 A17 17 0 0 1 17.28 40.5" fill="none" stroke={`url(#${id}b)`} strokeWidth="3" strokeLinecap="round" />
      <circle cx="46.72" cy="23.5" r="4.6" fill={`url(#${id}s)`} />
      <circle cx="17.28" cy="40.5" r="4.6" fill={`url(#${id}s)`} />
    </svg>
  );
}
