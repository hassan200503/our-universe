import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/context";
import { worldFor } from "@/lib/worlds";
import { WorldEmblem } from "@/components/world-emblem";
import { Avatar } from "@/components/avatar";
import { WorldTabs } from "./world-tabs";

export default async function WorldLayout({ children, params }: LayoutProps<"/world/[slug]">) {
  const ctx = await requireCtx();
  const { slug } = await params;
  const person = ctx.members.find((m) => m.slug === slug);
  if (!person) notFound();
  const own = person.id === ctx.me.id;
  const first = person.displayName.split(" ")[0];
  const motto = person.motto ?? worldFor(person.theme).tagline;
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
      <header className={`bg-${person.theme} grain relative overflow-hidden border-b border-line`}>
        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
          <div className="flex items-center justify-between gap-6">
            <div className="max-w-2xl rise">
              <Avatar name={person.displayName} url={person.avatarUrl} theme={person.theme} size={96} ring className="mb-5" />
              <p className="eyebrow">{own ? "Your world" : `${first}'s world`}</p>
              <h1 className="display-xl mt-3">{person.displayName}</h1>
              {person.birthday && (
                <p className="mt-2 text-sm text-muted">
                  🎂 Birthday: {new Date(`${person.birthday}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}
                </p>
              )}
              <p className={`mt-4 text-lg ${person.theme === "hassan" ? "font-mono text-base" : ""}`}>
                {[person.course, person.headline ?? person.focus].filter(Boolean).join(" · ")}
              </p>
              <p className={`mt-3 text-sm text-muted ${person.theme === "hassan" ? "font-mono" : "font-display italic"}`}>
                {person.theme === "hassan" ? <span className="text-accent-2">$ </span> : null}
                {motto}
              </p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <WorldEmblem theme={person.theme} />
            </div>
          </div>
          <WorldTabs base={`/world/${person.slug}`} tabs={tabs} />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8">{children}</div>
    </div>
  );
}
