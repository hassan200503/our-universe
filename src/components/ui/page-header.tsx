export function PageHeader({ eyebrow, title, children, world }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; world: string }) {
  return (
    <div data-world={world} className={`bg-${world} grain relative overflow-hidden`}>
      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-16">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function Container({ children, world, className = "" }: { children: React.ReactNode; world?: string; className?: string }) {
  return (
    <div data-world={world} className={`mx-auto max-w-6xl px-4 pb-20 ${className}`}>
      {children}
    </div>
  );
}
