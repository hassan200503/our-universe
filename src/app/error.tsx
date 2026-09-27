"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-world="us" className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div>
        <p className="text-4xl" aria-hidden>
          🌧️
        </p>
        <h1 className="font-display mt-4 text-2xl font-semibold">Something went quiet for a moment.</h1>
        <p className="mt-2 text-muted">Your memories and saved discoveries are safe. Try again in a second.</p>
        <button onClick={reset} className="btn mt-6">
          Try again
        </button>
      </div>
    </div>
  );
}
