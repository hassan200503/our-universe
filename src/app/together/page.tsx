import { requireCtx } from "@/lib/context";
import { readRoom } from "@/lib/together/room";
import { RoomClient } from "@/components/together/room-client";
import { TogetherTabs } from "@/components/together/tabs";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Together" };

export default async function TogetherRoomPage() {
  const ctx = await requireCtx();
  const initial = await readRoom(ctx, null, null);
  const first = ctx.partners[0]?.displayName.split(" ")[0];
  return (
    <>
      <PageHeader world="us" eyebrow="Together" title="Wherever you are, in the same moment">
        Press play, pause or skip and it happens for both of you, second by second. Talk{first ? ` with ${first}` : ""} as you listen, or call when words aren&apos;t enough.
        <div className="mt-6">
          <TogetherTabs />
        </div>
      </PageHeader>
      <Container world="us">
        <RoomClient initial={initial} />
      </Container>
    </>
  );
}
