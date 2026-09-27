import Link from "next/link";
import { notFound } from "next/navigation";
import { worldPerson } from "@/lib/world-page";
import { worldFor } from "@/lib/worlds";
import { KnowledgePage } from "@/components/knowledge-page";

export const metadata = { title: "Questions I'm Thinking About" };

export default async function ThinkingPage({ params, searchParams }: PageProps<"/world/[slug]/thinking">) {
  const { ctx, person, own, first } = await worldPerson(params);
  if (!person.features.includes("thinking")) notFound();
  const sp = await searchParams;
  const cfg = worldFor(person.theme);
  return (
    <>
      <KnowledgePage
        ctx={ctx}
        person={person}
        own={own}
        space="thinking"
        kinds={cfg.thinkingKinds ?? cfg.vaultKinds}
        title="Questions I'm Thinking About"
        intro={own ? "A thinking journal. Questions, arguments, quotes, philosophers and half-formed thoughts — no answers required." : `What ${first} is turning over.`}
        q={typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined}
        tag={typeof sp.tag === "string" ? sp.tag : undefined}
        emptyOwn="What's a question you can't stop thinking about? →"
      />
      <p className="mt-8 text-sm text-muted">
        Looking for something to think with? The{" "}
        <Link href="/discover/philosophy" className="text-accent underline">
          Ideas &amp; Philosophy feed
        </Link>{" "}
        pulls new entries from the Stanford Encyclopedia of Philosophy and long-form essays from Aeon and Psyche.
      </p>
    </>
  );
}
