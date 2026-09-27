/**
 * Issues a fresh passcode for every person, stores only its bcrypt hash, and
 * writes the plain passcodes to PASSCODES.local.md (git-ignored) so they can be
 * handed over privately. Nothing is printed.
 *
 *   npm run passcodes                      → local database
 *   DATABASE_URL=… npm run passcodes       → production (Neon)
 *   npm run passcodes -- --reuse           → re-apply the passcodes already in PASSCODES.local.md
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { people } from "../src/lib/db/schema";
import { passphrase } from "../src/lib/auth/passphrase";

const FILE = "PASSCODES.local.md";

function readExisting(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(FILE)) return map;
  for (const m of readFileSync(FILE, "utf8").matchAll(/^\| (\w+) \| [^|]+ \| `([^`]+)` \|$/gm)) map.set(m[1], m[2]);
  return map;
}

async function main() {
  const db = await getDb();
  const reuse = process.argv.includes("--reuse");
  const existing = readExisting();
  const everyone = await db.select({ id: people.id, slug: people.slug, name: people.displayName }).from(people);
  const rows: { slug: string; name: string; code: string }[] = [];
  for (const p of everyone) {
    const code = reuse && existing.get(p.slug) ? existing.get(p.slug)! : passphrase();
    await db.update(people).set({ passwordHash: await bcrypt.hash(code, 12) }).where(eq(people.id, p.id));
    rows.push({ slug: p.slug, name: p.name, code });
  }
  writeFileSync(
    FILE,
    [
      "# Our Universe — passcodes",
      "",
      "Keep this file private. It is git-ignored and never leaves this computer.",
      "Each person signs in by choosing their name, then typing their passcode. Change it any time in Settings → Passcode.",
      "",
      "| slug | name | passcode |",
      "| --- | --- | --- |",
      ...rows.map((r) => `| ${r.slug} | ${r.name} | \`${r.code}\` |`),
      "",
    ].join("\n"),
  );
  console.log(`${reuse ? "Re-applied" : "Issued"} passcodes for ${rows.map((r) => r.name).join(" and ")} → ${FILE}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
