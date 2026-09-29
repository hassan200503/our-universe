/** Starting points for Research, drawn from each person's interests (safe to import on the client). */
import type { TopicKey } from "@/lib/trends/topics";
import type { ResearchMode } from "./types";

export type Suggestion = { q: string; mode: ResearchMode };

export const MODES: { key: ResearchMode; label: string; short: string; hint: string }[] = [
  { key: "research", label: "Research studies", short: "Research", hint: "Reads real studies and the web, and cites them" },
  { key: "learn", label: "Learn it", short: "Learn", hint: "A step-by-step lesson with a self-check" },
  { key: "explain", label: "Explain simply", short: "Simply", hint: "The short, plain-words version" },
];

const BY_TOPIC: Record<TopicKey, Suggestion[]> = {
  software: [
    { q: "What does research say about pair programming and code quality?", mode: "research" },
    { q: "Teach me how database indexes work", mode: "learn" },
    { q: "Explain event-driven architecture simply", mode: "explain" },
  ],
  technology: [
    { q: "What do studies show about smartphone use and sleep?", mode: "research" },
    { q: "Teach me how large language models are trained", mode: "learn" },
    { q: "Explain how quantum computers differ from normal ones", mode: "explain" },
  ],
  philosophy: [
    { q: "What does psychology research say about what makes a meaningful life?", mode: "research" },
    { q: "Teach me Stoicism's core ideas", mode: "learn" },
    { q: "Explain the trolley problem and why it matters", mode: "explain" },
  ],
  nature: [
    { q: "What do studies say about time in nature and wellbeing?", mode: "research" },
    { q: "Teach me how forests communicate through fungal networks", mode: "learn" },
    { q: "Explain how animals migrate across continents", mode: "explain" },
  ],
  biotech: [
    { q: "What is the latest research on CRISPR gene therapies in patients?", mode: "research" },
    { q: "Teach me how mRNA vaccines work", mode: "learn" },
    { q: "Explain PCR simply", mode: "explain" },
  ],
  birds: [
    { q: "What does research say about how birds navigate during migration?", mode: "research" },
    { q: "Teach me how to identify birds by their song", mode: "learn" },
    { q: "Explain why some birds can mimic human speech", mode: "explain" },
  ],
  knitting: [
    { q: "What do studies say about knitting and stress or anxiety?", mode: "research" },
    { q: "Teach me how to read a knitting pattern", mode: "learn" },
    { q: "Explain the difference between knit and purl stitches", mode: "explain" },
  ],
  environment: [
    { q: "What does the latest research say about restoring degraded land in East Africa?", mode: "research" },
    { q: "Teach me how the carbon cycle works", mode: "learn" },
    { q: "Explain what a carbon footprint really measures", mode: "explain" },
  ],
};

const GENERAL: Suggestion[] = [
  { q: "What does research say about long-distance relationships?", mode: "research" },
  { q: "What do studies show about the best way to learn something new?", mode: "research" },
  { q: "Teach me how memory works, and how to remember more", mode: "learn" },
  { q: "Explain why we dream", mode: "explain" },
  { q: "What does the evidence say about gratitude and happiness?", mode: "research" },
  { q: "Teach me the basics of statistics for reading studies", mode: "learn" },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A handful of suggestions: some from each interest, some general, rotating daily. */
export function suggestionsFor(topics: TopicKey[], seed: string, n = 6): Suggestion[] {
  const pool = [...topics.flatMap((t) => BY_TOPIC[t] ?? []), ...GENERAL];
  const scored = pool.map((s) => ({ s, k: hash(`${seed}|${s.q}`) }));
  scored.sort((a, b) => a.k - b.k);
  const out: Suggestion[] = [];
  // At least one of each mode, then fill.
  for (const mode of ["research", "learn", "explain"] as const) {
    const hit = scored.find((x) => x.s.mode === mode && !out.includes(x.s));
    if (hit) out.push(hit.s);
  }
  for (const { s } of scored) if (out.length < n && !out.includes(s)) out.push(s);
  return out;
}
