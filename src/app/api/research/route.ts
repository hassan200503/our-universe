import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { ask, askSchema, listThreads } from "@/lib/research/server";

// Grounded answers with studies can take a while to write; streaming shows progress throughout.
export const maxDuration = 60;

/** GET /api/research — my research threads and the ones shared with me. */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json({ threads: await listThreads(ctx) }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/research {question, mode, threadId?} — answers as newline-delimited
 * JSON events: thread, status, studies, delta…, then done (or error).
 */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = askSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question first" }, { status: 400 });
  const encoder = new TextEncoder();
  const events = ask(ctx, parsed.data);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ t: "error", message: "Research couldn't finish. Try again.", retry: true }) + "\n"));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
