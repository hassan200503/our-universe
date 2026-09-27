import "server-only";
import { after } from "next/server";
import { runIngest } from "./ingest";
import { staleness } from "./query";

const STALE_MS = 75 * 60 * 1000;
const g = globalThis as unknown as { __ingesting?: boolean };

/**
 * Self-healing freshness: if the scheduled job hasn't run for a while (cron
 * down, laptop asleep in development), the next visitor's request schedules a
 * refresh of due sources after the response is sent. Visitors never wait on
 * external APIs.
 */
export async function refreshIfStale() {
  if (g.__ingesting) return;
  if ((await staleness()) < STALE_MS) return;
  g.__ingesting = true;
  after(async () => {
    try {
      // Short budget: serverless hosts cut background work off quickly.
      await runIngest({ budgetMs: 8_000 });
    } catch (e) {
      console.error("[trends] background refresh failed", e);
    } finally {
      g.__ingesting = false;
    }
  });
}
