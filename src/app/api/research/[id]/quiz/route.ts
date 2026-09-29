import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { GeminiError } from "@/lib/research/gemini";
import { quizFor } from "@/lib/research/server";

export const maxDuration = 60;

/** POST /api/research/:id/quiz — five questions to check what you've learned. */
export async function POST(_: NextRequest, { params }: RouteContext<"/api/research/[id]/quiz">) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const quiz = await quizFor(ctx, id);
    return quiz ? NextResponse.json(quiz) : NextResponse.json({ error: "Couldn't make a quiz from this one yet." }, { status: 422 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof GeminiError ? e.message : "Couldn't make a quiz right now." }, { status: 503 });
  }
}
