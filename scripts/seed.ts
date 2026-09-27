/**
 * Seeds the two people, their relationship, interests, and Hassan's verified
 * professional information. Safe to run repeatedly: existing rows are kept.
 *
 * Passcodes come from SEED_HASSAN_PASSCODE / SEED_WHITNEY_PASSCODE. When they
 * are missing, random passphrases are generated and appended to .env.local
 * (which git ignores) — they are never printed.
 *
 * Everything about Hassan below comes from his public portfolio
 * (hassan200503.github.io, skills and about pages) and his public GitHub repos.
 * Skill levels are his own self-assessments on the portfolio's 1–5 scale.
 * Nothing is invented; Whitney's profile is left for her to fill in.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { interests, people, preferences, projects, radarItems, radarLanes, relationshipMembers, relationships, skills } from "../src/lib/db/schema";

const WORDS = "amber river cedar falcon meadow lantern harbor willow summit ember orchid canyon maple heron coral tundra acacia savanna baobab kestrel".split(" ");
function passphrase() {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  return `${pick()}-${pick()}-${pick()}-${randomBytes(2).readUInt16BE() % 100}`;
}

function passcodeFor(slug: "hassan" | "whitney"): string {
  const key = `SEED_${slug.toUpperCase()}_PASSCODE`;
  const existing = process.env[key];
  if (existing) return existing;
  const generated = passphrase();
  const envFile = ".env.local";
  const current = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  appendFileSync(envFile, `${current && !current.endsWith("\n") ? "\n" : ""}${key}=${generated}\n`);
  console.log(`  generated a passcode for ${slug} → saved in .env.local as ${key}`);
  return generated;
}

const HASSAN_SKILLS: [category: string, name: string, level: number, evidence: string][] = [
  ["Backend", "Java 21", 4, "My strongest language. RentManager's backend is 21 modules of modern Java: records, sealed hierarchies, and the standard library where a framework isn't earning its place."],
  ["Backend", "Spring Boot 3", 4, "Web, Data JPA, Security, Validation, Actuator and scheduled jobs in a production deployment, tuned to fit a 512 MB free-tier container."],
  ["Backend", "Modular-monolith architecture", 4, "Ports and adapters with explicit module boundaries; one ArchUnit rule enforces a layer boundary in CI, the rest is still convention."],
  ["Backend", "Spring Security · JWT / JWKS", 4, "Clerk-issued tokens verified against JWKS, with tenancy taken from the signed claim, never from the request."],
  ["Backend", "Multi-tenant data isolation", 4, "Enforced at two layers, because a single missed where-clause is a data breach, not a bug."],
  ["Backend", "Concurrency & idempotency", 3, "Idempotency windows, transactional boundaries around the ledger and a database-backed outbox."],
  ["Data", "PostgreSQL", 4, "Schema design, constraints that make invalid states unrepresentable, indexing, and an append-only rent ledger."],
  ["Data", "Flyway migrations", 4, "99 sequential migrations, none edited after running against a database."],
  ["Data", "JPA / Hibernate", 3, "Entity mapping, fetch strategies and transaction boundaries."],
  ["Data", "Domain modelling", 4, "Leases, occupancies, ledgers, commissions and payouts — the part I enjoy most."],
  ["Frontend", "TypeScript", 4, "Client types generated from the backend's OpenAPI contract."],
  ["Frontend", "React 19", 4, "258 components across four user roles in RentManager."],
  ["Frontend", "Next.js (App Router)", 4, "62 routes with server and client components, route handlers and middleware-level auth, deployed."],
  ["Frontend", "TanStack Query", 3, "Query keys, invalidation, and optimistic updates only where rolling back is safe."],
  ["Frontend", "Tailwind CSS · design systems", 3, "A token-driven UI with light and dark themes."],
  ["Frontend", "Accessibility", 3, "Keyboard paths, focus states, landmarks and honest alt text, built in as I go."],
  ["Mobile", "React Native · Expo", 3, "A 44-screen RentManager app on Expo Router sharing the web app's generated API client."],
  ["Mobile", "Push notifications", 3, "Chosen over SMS because push is free and SMS is not."],
  ["Mobile", "Offline & secure storage", 3, "Tokens in the device keystore; connectivity detection instead of silent failure."],
  ["Integrations", "M-Pesa Daraja", 4, "STK push to collect rent and B2C to pay landlords, with callbacks that arrive late, twice or out of order."],
  ["Integrations", "Clerk authentication", 4, "JWKS verification, lifecycle webhooks, and role mapping shared by web and mobile."],
  ["Integrations", "Africa's Talking SMS", 3, "Sent through a database outbox with a scheduled sweep so outages delay, not lose, messages."],
  ["Integrations", "Kenyan tax rules (VAT, MRI)", 3, "Built from the Finance Act, fail-closed by default."],
  ["Engineering", "JUnit 5 · Mockito", 4, "1,588 tests across 261 test classes, written money-path first."],
  ["Engineering", "Testcontainers", 3, "Integration tests against a real PostgreSQL container."],
  ["Engineering", "ArchUnit", 3, "Architecture encoded as a test — one module so far."],
  ["Engineering", "Vitest · RN Testing Library", 3, "Component and hook coverage on the frontend."],
  ["Engineering", "Docker", 3, "Multi-stage production images and a Compose setup for local development."],
  ["Engineering", "Deploying a real system", 3, "RentManager runs on Render, Netlify and Neon at zero cost, with keep-awake pings and encrypted backups."],
  ["Engineering", "Git & CI", 3, "GitHub Actions for builds and the nightly backup job."],
  ["Engineering", "Observability at production scale", 2, "Sentry, health checks and structured logs in place; not yet tested by real load or incidents."],
  ["Engineering", "Distributed systems", 1, "Studied, deliberately not used: a modular monolith with an outbox was the right call at this scale."],
];

const HASSAN_INTRO = [
  "I'm Hassan — a Computer Science student in Kenya and a full-stack Java developer.",
  "Most of what I know about building real software came from building RentManager end to end: a Spring Boot API, a Next.js web app and an Expo mobile app, deployed and running. I like problems where correctness matters more than speed — money, records, anything that can't afford to be subtly wrong.",
  "Outside the code I'm drawn to where technology is heading, to nature, and to philosophy: the questions underneath the work. I'm still learning, on purpose, every week.",
].join("\n\n");

async function main() {
  const db = await getDb();
  console.log("Seeding Our Universe…");

  const existing = await db.select().from(people);
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  async function ensurePerson(values: Omit<typeof people.$inferInsert, "passwordHash">) {
    const found = bySlug.get(values.slug);
    if (found) return found;
    const passwordHash = await bcrypt.hash(passcodeFor(values.slug as "hassan" | "whitney"), 12);
    const [row] = await db.insert(people).values({ ...values, passwordHash }).returning();
    console.log(`  created ${values.displayName}`);
    return row;
  }

  const hassan = await ensurePerson({
    slug: "hassan",
    displayName: "Hassan Tsuma",
    headline: "Full-Stack Java Developer",
    course: "Computer Science",
    focus: "Full-Stack Java Development",
    intro: HASSAN_INTRO,
    motto: "Keep building. Keep learning. Keep questioning.",
    theme: "hassan",
    journalTitle: "Engineering Journey",
    radarTitle: "Tech Radar",
    features: ["projects", "thinking"],
  });

  // Her official name is Whitney. "Sumaiya" is the name Hassan gave her: an
  // optional, editable nickname, never a key, slug or public label.
  const whitney = await ensurePerson({
    slug: "whitney",
    displayName: "Whitney",
    nickname: "Sumaiya",
    focus: "Biotechnology",
    intro: "Biotechnology, birds, knitting, nature and the environment — this is Whitney's corner of our universe, and it grows with everything she learns.",
    motto: "Curious about how life works — from genes to birdsong.",
    theme: "whitney",
    journalTitle: "Biotechnology Journey",
    radarTitle: "Biotechnology Radar",
    features: [],
  });

  let [rel] = await db.select().from(relationships).limit(1);
  if (!rel) {
    [rel] = await db.insert(relationships).values({ name: "Our Universe" }).returning();
    await db.insert(relationshipMembers).values([
      { relationshipId: rel.id, personId: hassan.id },
      { relationshipId: rel.id, personId: whitney.id },
    ]);
    console.log("  created relationship");
  }

  const interestSeed: [string, string[]][] = [
    [hassan.id, ["software", "technology", "nature", "philosophy"]],
    [whitney.id, ["biotech", "birds", "knitting", "nature", "environment"]],
  ];
  for (const [personId, topics] of interestSeed) {
    await db
      .insert(interests)
      .values(topics.map((topic, position) => ({ personId, topic, position })))
      .onConflictDoNothing();
    await db.insert(preferences).values({ personId }).onConflictDoNothing();
  }

  if (!(await db.select().from(skills).where(eq(skills.personId, hassan.id)).limit(1)).length) {
    await db.insert(skills).values([
      {
        personId: hassan.id,
        name: "Full-Stack Java Development",
        category: "Primary",
        level: 4,
        evidence: "Java and Spring Boot on the backend, Next.js and React on the web, Expo on mobile — one system, built and deployed end to end.",
        primary: true,
        position: 0,
        visibility: "public",
      },
      ...HASSAN_SKILLS.map(([category, name, level, evidence], i) => ({
        personId: hassan.id,
        name,
        category,
        level,
        evidence,
        position: i + 1,
        visibility: "public" as const,
      })),
    ]);
    console.log(`  added ${HASSAN_SKILLS.length + 1} skills for Hassan`);
  }

  if (!(await db.select().from(projects).where(eq(projects.personId, hassan.id)).limit(1)).length) {
    await db.insert(projects).values([
      {
        personId: hassan.id,
        name: "RentManager",
        description: "Rental management for Kenyan landlords and renters: a landlord dashboard, a renter portal and a mobile app over one API.",
        problem: "Collecting rent, paying landlords out and keeping an honest ledger in a market that runs on M-Pesa.",
        stack: ["Java 21", "Spring Boot 3", "PostgreSQL", "Next.js", "React", "TypeScript", "Expo", "Clerk", "M-Pesa Daraja"],
        architecture: "Modular monolith with ports and adapters, multi-tenant isolation at two layers, an append-only ledger and a database outbox.",
        status: "live",
        repoUrl: "https://github.com/hassan200503/rentmanager-backend",
        liveUrl: "https://rentmanager-ke.netlify.app/",
        lessons: "Running a real system at zero cost: fitting Spring Boot in 512 MB, keeping a free container awake for M-Pesa callbacks, and scheduling encrypted backups.",
        startedOn: "2026-06-11",
        current: true,
        visibility: "public",
      },
      {
        personId: hassan.id,
        name: "Portfolio site",
        description: "A hand-written portfolio where every skill is rated by what I've actually shipped.",
        stack: ["HTML", "CSS", "JavaScript"],
        status: "live",
        repoUrl: "https://github.com/hassan200503/hassan200503.github.io",
        liveUrl: "https://hassan200503.github.io/",
        startedOn: "2026-09-14",
        visibility: "public",
      },
      {
        personId: hassan.id,
        name: "WhatsApp persona bot",
        description: "Auto-replies to WhatsApp messages in your own voice while you're offline and learns your writing style over time.",
        stack: ["JavaScript"],
        status: "building",
        repoUrl: "https://github.com/hassan200503/whatsapp-persona-bot",
        startedOn: "2026-09-23",
        visibility: "shared",
      },
      {
        personId: hassan.id,
        name: "Our Universe",
        description: "This website: Hassan's world, Whitney's world, and the story we're writing together — with live discoveries from the real world.",
        problem: "Somewhere to keep our story that grows richer the more we use it.",
        stack: ["Next.js", "TypeScript", "PostgreSQL", "Drizzle", "TanStack Query"],
        architecture: "Source adapters → normalise → deduplicate → categorise → Postgres → keyset-paginated API → infinite feeds.",
        status: "building",
        startedOn: new Date().toISOString().slice(0, 10),
        visibility: "private",
      },
    ]);
    console.log("  added Hassan's projects");
  }

  const lanes: [string, string[]][] = [
    [hassan.id, ["Learning", "Exploring", "Using", "Watching", "Building", "Mastered"]],
    [whitney.id, ["Learning", "Exploring", "Researching", "Practicing", "Interested In", "Mastered"]],
  ];
  for (const [personId, names] of lanes) {
    if ((await db.select().from(radarLanes).where(eq(radarLanes.personId, personId)).limit(1)).length) continue;
    const inserted = await db
      .insert(radarLanes)
      .values(names.map((name, position) => ({ personId, name, position })))
      .returning();
    if (personId === hassan.id) {
      const lane = (n: string) => inserted.find((l) => l.name === n)!.id;
      await db.insert(radarItems).values([
        ...["Java 21", "Spring Boot 3", "PostgreSQL", "Next.js", "TypeScript"].map((name) => ({ personId, laneId: lane("Using"), name })),
        { personId, laneId: lane("Learning"), name: "Observability at production scale", note: "Metrics, alerting and running a system through real load." },
        { personId, laneId: lane("Building"), name: "RentManager" },
      ]);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
