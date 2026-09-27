/**
 * Per-identity vocabulary. The data model is the same for everyone; this only
 * changes labels and suggested kinds, keyed by the person's theme. A new person
 * without a theme entry gets the generic set.
 */
export type WorldConfig = {
  journalKinds: { value: string; label: string }[];
  thinkingKinds?: { value: string; label: string }[];
  vaultKinds: { value: string; label: string }[];
  tagline: string;
};

const VAULT = [
  { value: "article", label: "📰 Article" },
  { value: "note", label: "📝 Note" },
  { value: "concept", label: "💡 Concept" },
  { value: "idea", label: "✨ Idea" },
  { value: "question", label: "❓ Question" },
  { value: "resource", label: "📚 Resource" },
  { value: "discovery", label: "🔭 Discovery" },
];

const GENERIC: WorldConfig = {
  tagline: "Keep learning.",
  journalKinds: [
    { value: "learned", label: "📘 Something I learned" },
    { value: "resource", label: "📚 Book / resource" },
    { value: "question", label: "❓ Question to research" },
    { value: "goal", label: "🎯 Goal" },
    { value: "idea", label: "✨ Idea" },
  ],
  vaultKinds: VAULT,
};

export const WORLDS: Record<string, WorldConfig> = {
  hassan: {
    tagline: "Keep building. Keep learning. Keep questioning.",
    journalKinds: [
      { value: "learned", label: "📘 Thing I learned" },
      { value: "technology", label: "🧪 Technology studied" },
      { value: "project", label: "🛠️ Project work" },
      { value: "lesson", label: "🧭 Engineering lesson" },
      { value: "architecture", label: "🏛️ Architecture decision" },
      { value: "discovery", label: "💡 Programming discovery" },
      { value: "problem", label: "🧩 Problem solved" },
      { value: "research", label: "🔍 Thing to research" },
      { value: "resource", label: "📚 Book / resource" },
      { value: "interesting", label: "⚡ Interesting technology" },
      { value: "goal", label: "🎯 Career goal" },
      { value: "idea", label: "✨ Software idea" },
    ],
    thinkingKinds: [
      { value: "question", label: "❓ Question" },
      { value: "argument", label: "⚖️ Argument" },
      { value: "idea", label: "💭 Idea" },
      { value: "quote", label: "❝ Quote" },
      { value: "philosopher", label: "🏛️ Philosopher" },
      { value: "reflection", label: "🌙 Reflection" },
      { value: "book", label: "📖 Book" },
      { value: "thought", label: "✍️ Personal thought" },
    ],
    vaultKinds: VAULT,
  },
  whitney: {
    tagline: "Curious about how life works.",
    journalKinds: [
      { value: "learned", label: "🧬 Concept I learned" },
      { value: "technique", label: "🔬 Lab technique" },
      { value: "paper", label: "📄 Paper I read" },
      { value: "lecture", label: "🎓 Lecture / class" },
      { value: "experiment", label: "🧫 Experiment" },
      { value: "question", label: "❓ Question to research" },
      { value: "resource", label: "📚 Book / resource" },
      { value: "goal", label: "🎯 Career goal" },
      { value: "idea", label: "✨ Idea" },
    ],
    vaultKinds: VAULT,
  },
};

export function worldFor(theme: string): WorldConfig {
  return WORLDS[theme] ?? GENERIC;
}

export function kindLabel(kinds: { value: string; label: string }[], v: string): string {
  return kinds.find((k) => k.value === v)?.label ?? v;
}
