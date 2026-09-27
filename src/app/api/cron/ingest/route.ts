import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runIngest } from "@/lib/trends/ingest";

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called hourly by GitHub Actions (or cron-job.org) with `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Serverless functions on free tiers time out quickly; whatever is left stays due for the next call.
  const summary = await runIngest({ budgetMs: 8_000 });
  return NextResponse.json({
    ranAt: summary.ranAt,
    attempted: summary.attempted,
    stored: summary.stored,
    failed: summary.failed.map((f) => ({ source: f.key, error: f.error })),
  });
}

export const GET = handle;
export const POST = handle;
