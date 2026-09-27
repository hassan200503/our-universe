import { worldPerson } from "@/lib/world-page";
import { worldFor } from "@/lib/worlds";
import { KnowledgePage } from "@/components/knowledge-page";

export const metadata = { title: "Knowledge Vault" };

export default async function VaultPage({ params, searchParams }: PageProps<"/world/[slug]/vault">) {
  const { ctx, person, own, first } = await worldPerson(params);
  const sp = await searchParams;
  return (
    <KnowledgePage
      ctx={ctx}
      person={person}
      own={own}
      space="vault"
      kinds={worldFor(person.theme).vaultKinds}
      title={`${own ? "Your" : `${first}'s`} Knowledge Vault`}
      intro={own ? "Articles, notes, concepts, questions and resources — private unless you choose otherwise. Anything from a feed can land here with “Add to my Knowledge Vault”." : `The parts of ${first}'s vault that are shared with you.`}
      q={typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined}
      tag={typeof sp.tag === "string" ? sp.tag : undefined}
      emptyOwn="Your vault is empty. Save something from a feed, or add a note →"
    />
  );
}
