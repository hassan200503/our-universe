/** Applies migrations to DATABASE_URL (production). PGlite migrates itself on first use. */
import { migrateNow } from "../src/lib/db/client";

if (!process.env.DATABASE_URL) {
  // Vercel preview builds without a database, or local builds: nothing to migrate.
  console.log("No DATABASE_URL: skipping migrations.");
  process.exit(0);
}

migrateNow()
  .then(() => {
    console.log("Migrations applied.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
