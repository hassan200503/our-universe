import { requireCtx } from "@/lib/context";
import { ChatView } from "@/components/chat/chat-view";
import { TogetherTabs } from "@/components/together/tabs";

export const metadata = { title: "Messages" };

export default async function ChatPage() {
  const ctx = await requireCtx();
  if (!ctx.partners[0]) return <p className="mx-auto max-w-md p-10 text-center text-muted">Messages open once your partner has joined Our Universe.</p>;
  return (
    <div className="sm:px-4">
      <div className="hidden justify-center pt-5 sm:flex">
        <TogetherTabs />
      </div>
      <ChatView variant="page" />
    </div>
  );
}
