export function PageHeader({ eyebrow, title, children, world }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; world: string }) {
  return (
    <div data-world={world} className={`bg-${world}`}>
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:pt-14">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-muted">{children}</div>}
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
