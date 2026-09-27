/** Applies migrations to DATABASE_URL (production). PGlite migrates itself on first use. */
import path from "node:path";
import { getDb } from "../src/lib/db/client";

getDb()
  .then(async (db) => {
    const url = process.env.DATABASE_URL;
    const folder = path.join(process.cwd(), "drizzle");
    if (url && /\.neon\.tech[/:?]/.test(url)) {
      const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
      await migrate(db as never, { migrationsFolder: folder });
    } else if (url) {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(db, { migrationsFolder: folder });
    }
    console.log("Migrations applied.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
