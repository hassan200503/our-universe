import Link from "next/link";

export default function NotFound() {
  return (
    <div data-world="us" className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div>
        <p className="text-4xl" aria-hidden>
          🔭
        </p>
        <h1 className="font-display mt-4 text-2xl font-semibold">This corner of the universe is empty.</h1>
        <p className="mt-2 text-muted">The page may have moved, or it isn&apos;t shared with you.</p>
        <Link href="/" className="btn mt-6">
          Back home
        </Link>
      </div>
    </div>
  );
}
