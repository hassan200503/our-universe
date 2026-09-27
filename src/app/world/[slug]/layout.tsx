import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/context";
import { worldFor } from "@/lib/worlds";
import { WorldTabs } from "./world-tabs";

export default async function WorldLayout({ children, params }: LayoutProps<"/world/[slug]">) {
  const ctx = await requireCtx();
  const { slug } = await params;
  const person = ctx.members.find((m) => m.slug === slug);
  if (!person) notFound();
  const own = person.id === ctx.me.id;
  const first = person.displayName.split(" ")[0];
  const tabs = [
    { href: "", label: "Dashboard" },
    { href: "/journal", label: person.journalTitle },
    ...(person.features.includes("projects") ? [{ href: "/projects", label: "Things I'm Building" }] : []),
    { href: "/skills", label: "Skills" },
    { href: "/radar", label: person.radarTitle },
    ...(person.features.includes("thinking") ? [{ href: "/thinking", label: "Questions I'm Thinking About" }] : []),
    { href: "/vault", label: "Knowledge Vault" },
  ];
  return (
    <div data-world={person.theme}>
      <header className={`bg-${person.theme} border-b border-line`}>
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">{own ? "Your world" : `${first}'s world`}</p>
              <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{person.displayName}</h1>
              <p className={`mt-3 text-lg ${person.theme === "hassan" ? "font-mono text-base" : ""}`}>
                {[person.course, person.headline ?? person.focus].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-sm italic text-muted">{person.motto ?? worldFor(person.theme).tagline}</p>
            </div>
          </div>
          <WorldTabs base={`/world/${person.slug}`} tabs={tabs} />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8">{children}</div>
    </div>
  );
}
