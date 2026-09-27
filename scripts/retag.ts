/** Re-applies category and tag rules from src/lib/trends/topics.ts to stored items. */
import { retagAll } from "../src/lib/trends/ingest";

retagAll()
  .then((n) => {
    console.log(`Re-tagged ${n} items.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
