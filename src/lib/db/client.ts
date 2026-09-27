import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * One database handle per server process.
 *
 * - With DATABASE_URL set (production on Neon, or any Postgres) we use node-postgres.
 * - Without it we run an embedded PGlite database in `.data/` so the site works
 *   locally with zero setup, and migrate it on first use.
 *
 * Both drivers expose the same Drizzle query API.
 */
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzlePg(pool, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
  const client = new PGlite(path.join(process.cwd(), ".data", "pglite"));
  const db = drizzleLite(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  globalForDb.__db ??= create();
  return globalForDb.__db;
}
