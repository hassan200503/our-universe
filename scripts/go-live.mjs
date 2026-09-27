#!/usr/bin/env node
/**
 * One-command production setup. Run it in your own terminal:
 *
 *   npm run go-live
 *
 * You paste the Neon connection string once (hidden as you type). The script:
 *   1. migrates and seeds the Neon database, applies the passcodes already in
 *      PASSCODES.local.md, and loads the first live discoveries;
 *   2. stores DATABASE_URL as a GitHub Actions secret (for the scheduled refresh);
 *   3. logs in to Netlify (your browser opens; you approve), creates the site,
 *      sets DATABASE_URL, SESSION_SECRET and CRON_SECRET, and deploys.
 *
 * Secrets never appear on screen and are only kept in .env.production.local,
 * which git ignores. Safe to re-run: every step is idempotent.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import readline from "node:readline";

const REPO = "hassan200503/our-universe";
const ENV_FILE = ".env.production.local";

function step(title) {
  console.log(`\n\x1b[35m❤ ${title}\x1b[0m`);
}

// cmd.exe splits unquoted arguments at & | < > ^ — quote them on Windows.
const quote = (a) => (process.platform === "win32" && /[\s&|<>^%"]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);

function run(cmd, args, env = {}, { input, allowFail = false, capture = false } = {}) {
  const r = spawnSync(cmd, args.map(quote), {
    stdio: capture ? ["pipe", "pipe", "inherit"] : input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit",
    input,
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (r.status !== 0 && !allowFail) {
    // Only the leading arguments: later ones can be secret values.
    console.error(`\n✗ "${cmd} ${args.slice(0, 3).join(" ")} …" failed. Fix the message above and run npm run go-live again.`);
    process.exit(1);
  }
  return r;
}

function readEnvFile() {
  const env = {};
  if (!existsSync(ENV_FILE)) return env;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function writeEnvFile(env) {
  writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
      else process.stdout.write("*");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const env = readEnvFile();

step("Neon connection string");
if (!env.DATABASE_URL) {
  console.log("In the Neon console, open project our-universe → Connect → turn on \"Connection pooling\" → copy the string.");
  const url = await askHidden("Paste it here (hidden): ");
  if (!/^postgres(ql)?:\/\/.+@.+\/.+/.test(url)) {
    console.error("That doesn't look like a Postgres connection string (postgresql://user:password@host/db).");
    process.exit(1);
  }
  env.DATABASE_URL = url;
}
env.SESSION_SECRET ||= randomBytes(32).toString("base64url");
env.CRON_SECRET ||= randomBytes(24).toString("base64url");
writeEnvFile(env);
console.log(`Saved to ${ENV_FILE} (git-ignored).`);

const db = { DATABASE_URL: env.DATABASE_URL };

step("Creating tables");
run("npm", ["run", "db:migrate"], db);

step("Adding Hassan, Whitney and your worlds");
// Seed with the passcodes you already have, so none are generated and discarded.
const codes = Object.fromEntries(
  [...(existsSync("PASSCODES.local.md") ? readFileSync("PASSCODES.local.md", "utf8") : "").matchAll(/^\| (\w+) \| [^|]+ \| `([^`]+)` \|$/gm)].map((m) => [`SEED_${m[1].toUpperCase()}_PASSCODE`, m[2]]),
);
run("npm", ["run", "seed"], { ...db, ...codes });

step("Applying your passcodes from PASSCODES.local.md");
if (!existsSync("PASSCODES.local.md")) {
  console.error("PASSCODES.local.md is missing — run `npm run passcodes` first (with the dev server stopped).");
  process.exit(1);
}
run("npm", ["run", "passcodes", "--", "--reuse"], db);

step("Fetching the first live discoveries (about a minute)");
run("npm", ["run", "ingest", "--", "--force"], db);

step("GitHub secret for the scheduled refresh");
run("gh", ["secret", "set", "DATABASE_URL", "--repo", REPO], {}, { input: env.DATABASE_URL });

step("Netlify login (your browser will open — approve it there)");
const netlify = ["--yes", "netlify-cli@latest"];
const status = run("npx", [...netlify, "status"], {}, { allowFail: true, capture: true });
if (status.status !== 0 || /Not logged in/i.test(status.stdout ?? "")) run("npx", [...netlify, "login"]);

step("Netlify site");
if (!existsSync(".netlify/state.json")) {
  const name = `our-universe-${randomBytes(3).toString("hex")}`;
  console.log(`Creating ${name}.netlify.app — if asked, pick your own team.`);
  run("npx", [...netlify, "sites:create", "--name", name]);
}

step("Setting the site's secrets");
for (const key of ["DATABASE_URL", "SESSION_SECRET", "CRON_SECRET"]) {
  run("npx", [...netlify, "env:set", key, env[key]], {}, { capture: true });
  console.log(`  ✓ ${key}`);
}

step("Building and deploying (a few minutes)");
const deploy = run("npx", [...netlify, "deploy", "--build", "--prod", "--json"], {}, { capture: true });
let url = null;
try {
  const json = JSON.parse(deploy.stdout.slice(deploy.stdout.indexOf("{")));
  url = json.url ?? json.deploy_url;
} catch {
  url = deploy.stdout.match(/https:\/\/[a-z0-9-]+\.netlify\.app/)?.[0] ?? null;
}
if (url) writeFileSync("DEPLOYED.local.md", `# Our Universe is live\n\n${url}\n`);

console.log(`\n\x1b[35m❤ Our Universe is live: ${url ?? "(see the Netlify output above)"}\x1b[0m`);
console.log("Sign in with the passcodes in PASSCODES.local.md.");
