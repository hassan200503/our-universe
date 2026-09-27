import { requireCtx } from "@/lib/context";
import { storageMode } from "@/lib/media/storage";
import { GalleryGrid } from "@/components/gallery/grid";
import { Uploader } from "@/components/gallery/uploader";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Our Gallery" };

export default async function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  const ctx = await requireCtx();
  const { kind } = await searchParams;
  const mode = storageMode();
  const names = ctx.members.map((m) => m.displayName.split(" ")[0]).join(" & ");
  return (
    <>
      <PageHeader world="us" eyebrow="Our gallery 📸" title="Everything we share, in one place">
        Photos, videos and songs from {names}. Whatever one of you posts appears for the other straight away — react, comment, or press
        <strong> Play together</strong> to enjoy it at the same moment, wherever you both are.
      </PageHeader>
      <Container world="us">
        <Uploader enabled={mode !== "none"} disabledReason="Photo and video storage needs one switch in Vercel (Storage → Blob → Connect). Songs and videos from YouTube already work." />
        <div className="mt-10">
          <GalleryGrid initialKind={typeof kind === "string" ? kind : null} />
        </div>
      </Container>
    </>
  );
}
