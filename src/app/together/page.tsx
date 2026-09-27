import { requireCtx } from "@/lib/context";
import { readRoom } from "@/lib/together/room";
import { RoomClient } from "@/components/together/room-client";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Together" };

export default async function TogetherRoomPage() {
  const ctx = await requireCtx();
  const initial = await readRoom(ctx, null, null);
  return (
    <>
      <PageHeader world="us" eyebrow="The Together room 🎧" title="Listen and watch together, wherever you are">
        When one of you presses play, pause or skip, it happens for both of you — in sync, second by second. Chat and send reactions while you
        watch.
      </PageHeader>
      <Container world="us">
        <RoomClient initial={initial} />
      </Container>
    </>
  );
}
