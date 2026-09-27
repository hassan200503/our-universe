/**
 * Fetches every due trend source once and prints a summary.
 *   npm run ingest            → only sources that are due
 *   npm run ingest -- --force → every source now
 *
 * With the local PGlite database, stop `npm run dev` first: PGlite allows one
 * process at a time. (While the site runs it refreshes itself when stale.)
 */
import { runIngest } from "../src/lib/trends/ingest";

runIngest({ force: process.argv.includes("--force") })
  .then((s) => {
    for (const r of s.results) console.log(`${r.ok ? "✓" : "✗"} ${r.key.padEnd(20)} ${r.skipped ? "not modified" : r.ok ? `+${r.stored}` : r.error}`);
    console.log(`\n${s.attempted} sources, ${s.stored} new items, ${s.failed.length} failed.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
