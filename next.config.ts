import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // PGlite ships WASM and data files that must be loaded from node_modules, not bundled;
  // web-push relies on Node's crypto and https modules, so it runs as-is from node_modules too.
  serverExternalPackages: ["@electric-sql/pglite", "web-push"],
  // The migrations are read from disk at runtime when a server finds its database behind
  // (see withSchema in src/lib/db/client.ts), so every function carries them.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/*.sql", "./drizzle/meta/_journal.json"],
  },
};

export default nextConfig;
