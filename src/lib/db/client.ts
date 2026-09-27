import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * One database handle per server process.
 *
 * - A Neon URL uses Neon's serverless driver: the Postgres protocol over a
 *   WebSocket on port 443, which suits serverless hosts and gets through
 *   networks that interfere with port 5432.
 * - Any other DATABASE_URL uses node-postgres.
 * - Without one we run an embedded PGlite database in `.data/` so the site
 *   works locally with zero setup, and migrate it on first use.
 *
 * All three expose the same Drizzle query API.
 */
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url && /\.neon\.tech[/:?]/.test(url)) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle: drizzleNeon } = await import("drizzle-orm/neon-serverless");
    // channel_binding isn't needed over the driver's own TLS WebSocket.
    const pool = new Pool({ connectionString: url.replace(/[&?]channel_binding=require/, ""), max: 5 });
    return drizzleNeon(pool, { schema }) as unknown as Db;
  }
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
