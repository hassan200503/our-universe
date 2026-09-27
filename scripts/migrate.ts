/** Applies migrations to DATABASE_URL (production). PGlite migrates itself on first use. */
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "../src/lib/db/client";

getDb()
  .then(async (db) => {
    if (process.env.DATABASE_URL) await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrations applied.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
