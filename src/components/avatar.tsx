/** A person's face, or their initial in their world's colour. Optional online dot. */
export function Avatar({
  name,
  url,
  theme,
  size = 32,
  online,
  ring = false,
  className = "",
}: {
  name: string;
  url: string | null | undefined;
  theme: string;
  size?: number;
  online?: boolean | null;
  ring?: boolean;
  className?: string;
}) {
  const dot = Math.max(8, Math.round(size / 4));
  return (
    <span data-world={theme} className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed private URL, already small
        <img src={url} alt={name} width={size} height={size} decoding="async" className={`size-full rounded-full object-cover ${ring ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`} />
      ) : (
        <span
          aria-label={name}
          className={`grid size-full place-items-center rounded-full bg-accent font-semibold text-accent-ink ${ring ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {name.trim()[0]?.toUpperCase()}
        </span>
      )}
      {online !== undefined && online !== null && (
        <span
          aria-label={online ? "Online" : "Offline"}
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-bg ${online ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500"}`}
          style={{ width: dot, height: dot }}
        >
          {online && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}
        </span>
      )}
    </span>
  );
}
