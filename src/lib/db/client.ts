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

const g = globalThis as unknown as { __migrated?: Promise<void> };

/** Applies any pending migrations (idempotent). */
export async function migrateNow(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const db = await getDb();
  const folder = path.join(process.cwd(), "drizzle");
  if (!url) {
    // The embedded database migrates when it opens; this catches a server that stayed up across a new migration.
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: folder });
  } else if (/\.neon\.tech[/:?]/.test(url)) {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    await migrate(db as never, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder: folder });
  }
}

/**
 * Runs a query that touches tables added after launch. Deploys migrate during
 * the build, but if a server ever runs ahead of its database (a missing table
 * or column), it applies the pending migrations once and retries, instead of
 * failing for everyone until the next scheduled migration.
 */
export async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code !== "42P01" && code !== "42703") throw e;
    g.__migrated ??= migrateNow().catch((err) => {
      g.__migrated = undefined;
      throw err;
    });
    await g.__migrated;
    return fn();
  }
}
