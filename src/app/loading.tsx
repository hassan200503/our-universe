export default function Loading() {
  return (
    <div data-world="us" className="grid min-h-[60dvh] place-items-center" role="status" aria-label="Loading">
      <span className="petal text-4xl text-accent motion-safe:animate-pulse" aria-hidden>
        ❤
      </span>
    </div>
  );
}
