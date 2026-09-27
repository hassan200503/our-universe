/**
 * Topic registry. A topic is one discovery feed ("Software Engineering",
 * "Birds", …). People subscribe to topics through the `interests` table, so a
 * new interest is one entry here plus sources in sources.ts: the frontend needs
 * no changes.
 *
 * Categories are assigned at ingest time by the first matching rule; an item
 * that matches none gets the topic's `fallbackCategory`.
 */

export type TopicKey =
  | "software"
  | "technology"
  | "philosophy"
  | "nature"
  | "biotech"
  | "birds"
  | "knitting"
  | "environment";

export type Topic = {
  key: TopicKey;
  label: string;
  emoji: string;
  blurb: string;
  /** "live" only when sources publish many times a day; otherwise honest cadence. */
  cadence: "live" | "daily" | "weekly";
  fallbackCategory: string;
  categories: { name: string; match: RegExp }[];
};

const r = (words: string) => new RegExp(`\\b(${words})`, "i");

export const TOPICS: Record<TopicKey, Topic> = {
  software: {
    key: "software",
    label: "Software Engineering",
    emoji: "💻",
    blurb: "Architecture, Java, Spring, APIs, databases, testing, security and the craft of building software.",
    cadence: "live",
    fallbackCategory: "Engineering practice",
    categories: [
      { name: "Java", match: r("java\\b|jdk|jvm|openjdk|graalvm|kotlin|project loom|valhalla|panama|jep") },
      { name: "Spring", match: r("spring") },
      { name: "Architecture", match: r("architect|microservice|monolith|domain-driven|ddd|event-driven|design pattern|clean architecture|hexagonal") },
      { name: "Distributed systems", match: r("distributed|consensus|kafka|replication|scalab|latency|queue") },
      { name: "Databases", match: r("database|postgres|sql|mysql|redis|index|query|schema") },
      { name: "APIs", match: r("\\bapi|rest\\b|graphql|grpc|openapi") },
      { name: "Security", match: r("secur|vulnerab|cve|exploit|auth|zero-day|supply chain|malware") },
      { name: "Cloud & DevOps", match: r("cloud|kubernetes|k8s|docker|devops|serverless|terraform|ci/cd|deploy|observab|sre") },
      { name: "Testing", match: r("test|quality|bug") },
      { name: "AI for developers", match: r("copilot|\\bai\\b|llm|agent|machine learning|model") },
      { name: "Developer tooling", match: r("ide|intellij|compiler|tooling|git\\b|github|build tool|gradle|maven") },
      { name: "Open source", match: r("open source|open-source|oss\\b|foundation|release") },
      { name: "Web development", match: r("react|next\\.js|javascript|typescript|css|browser|frontend|web") },
    ],
  },
  technology: {
    key: "technology",
    label: "Technology",
    emoji: "⚡",
    blurb: "AI, computing, chips, robotics, cybersecurity and the companies building what comes next.",
    cadence: "live",
    fallbackCategory: "Emerging technology",
    categories: [
      { name: "AI developer tools", match: r("coding assistant|copilot|code generation|ai coding|developer.*\\bai\\b|claude code|cursor") },
      { name: "Artificial intelligence", match: r("\\bai\\b|artificial intelligence|machine learning|llm|neural|chatbot|openai|anthropic|gemini|deepmind") },
      { name: "Cybersecurity", match: r("secur|hack|breach|ransomware|malware|vulnerab|cyber") },
      { name: "Semiconductors", match: r("chip|semiconductor|nvidia|tsmc|intel|amd|gpu|processor|transistor") },
      { name: "Robotics", match: r("robot|drone|autonomous|humanoid") },
      { name: "Computing", match: r("quantum|supercomput|computing|data center|datacenter") },
      { name: "Cloud", match: r("cloud|aws|azure|google cloud") },
      { name: "Startups", match: r("startup|raises|funding|series [a-e]|seed round|valuation|acqui") },
      { name: "Programming languages", match: r("programming language|rust\\b|python|compiler|webassembly") },
      { name: "Enterprise technology", match: r("enterprise|saas|platform") },
    ],
  },
  philosophy: {
    key: "philosophy",
    label: "Ideas & Philosophy",
    emoji: "🧠",
    blurb: "Long-form essays and new encyclopedia entries on ethics, mind, knowledge and meaning.",
    cadence: "daily",
    fallbackCategory: "Philosophy",
    categories: [
      { name: "Philosophy of technology", match: r("technolog|artificial intelligence|\\bai\\b|machine|algorithm|digital") },
      { name: "Philosophy of science", match: r("science|scientific|physics|evidence|explanation") },
      { name: "Consciousness", match: r("conscious|mind\\b|minds|perception|experience|self\\b") },
      { name: "Ethics", match: r("ethic|moral|virtue|justice|obligation|good life|harm") },
      { name: "Epistemology", match: r("knowledge|belief|epistem|truth|reason") },
      { name: "Logic", match: r("logic|paradox|argument|proof") },
      { name: "Ancient philosophy", match: r("plato|aristotle|socrat|stoic|epicur|ancient|confuci|buddh") },
      { name: "Existential questions", match: r("meaning|death|exist|freedom|absurd|happiness") },
      { name: "Human nature", match: r("human nature|psycholog|emotion|love|friendship") },
    ],
  },
  nature: {
    key: "nature",
    label: "Nature & Wildlife",
    emoji: "🌿",
    blurb: "Wildlife, forests, oceans, conservation and fresh sightings from naturalists in Kenya.",
    cadence: "live",
    fallbackCategory: "Nature",
    categories: [
      { name: "Wildlife sighting", match: r("^observation:") },
      { name: "Conservation", match: r("conserv|protect|poach|endangered|extinct|rewild") },
      { name: "Forests", match: r("forest|tree|deforest|rainforest|woodland") },
      { name: "Oceans & lakes", match: r("ocean|marine|sea\\b|reef|coral|lake|river|wetland|fish") },
      { name: "Wildlife", match: r("wildlife|animal|species|mammal|elephant|lion|primate|insect|bird") },
      { name: "Plants", match: r("plant|flower|fung|seed") },
      { name: "Climate", match: r("climate|warming|drought|heat|flood") },
      { name: "Earth from above", match: r("satellite|image of the day|from space|earth observatory") },
    ],
  },
  biotech: {
    key: "biotech",
    label: "Biotechnology",
    emoji: "🧬",
    blurb: "Genetics, CRISPR, synthetic biology, vaccines, diagnostics and where AI meets biology.",
    cadence: "live",
    fallbackCategory: "Biotechnology",
    categories: [
      { name: "AI + biotechnology", match: r("\\bai\\b|machine learning|deep learning|artificial intelligence|alphafold|language model") },
      { name: "CRISPR & gene editing", match: r("crispr|gene edit|base edit|prime edit|cas9|cas12") },
      { name: "Genomics", match: r("genom|sequenc|dna|rna|genetic|gene\\b|genes\\b") },
      { name: "Synthetic biology", match: r("synthetic biolog|synbio|engineered (microb|cell|bacteria)|biofoundry") },
      { name: "Vaccines", match: r("vaccin|mrna|immuni") },
      { name: "Diagnostics", match: r("diagnos|biomarker|assay|test\\b|detection") },
      { name: "Microbiology", match: r("microb|bacteri|virus|viral|pathogen|phage|fung") },
      { name: "Agricultural biotechnology", match: r("crop|agricultur|plant|seed|farm|food") },
      { name: "Environmental biotechnology", match: r("bioremed|pollut|plastic|environment|carbon capture|biofuel") },
      { name: "Pharmaceutical biotechnology", match: r("drug|therap|clinical trial|fda|antibod|pharma|biologic") },
      { name: "Computational biology", match: r("bioinformatic|computational|protein structure|model(l)?ing") },
      { name: "Molecular biology", match: r("protein|cell|molecul|enzyme") },
    ],
  },
  birds: {
    key: "birds",
    label: "Birds",
    emoji: "🐦",
    blurb: "Bird songs you can play, fresh sightings in Kenya and across Africa, videos, and bird conservation news.",
    cadence: "live",
    fallbackCategory: "Bird news",
    categories: [
      { name: "Bird songs", match: /^sound:/i },
      { name: "Bird videos", match: /^video:/i },
      { name: "Fresh sightings", match: r("^observation:") },
      { name: "Conservation", match: r("conserv|protect|endangered|threat|declin|habitat loss") },
      { name: "Migration", match: r("migrat|flyway") },
      { name: "Bird science", match: r("study|research|scientist|evolution|behavio") },
    ],
  },
  knitting: {
    key: "knitting",
    label: "Knitting",
    emoji: "🧶",
    blurb: "Video tutorials, patterns, techniques, yarn and real finished makes from knitters around the world.",
    cadence: "live",
    fallbackCategory: "Inspiration",
    categories: [
      { name: "Video tutorials", match: /^video:/i },
      { name: "Community makes", match: /^community:/i },
      { name: "Patterns", match: r("pattern|design|sweater|cardigan|shawl|hat\\b|socks|mittens|blanket") },
      { name: "Techniques", match: r("technique|how to|tutorial|stitch|cast on|bind off|colorwork|cable|brioche|lace|steek") },
      { name: "Yarn", match: r("yarn|wool|fiber|fibre|dye|merino|alpaca|mohair") },
      { name: "Tools", match: r("needle|tool|notion|swatch") },
      { name: "Makers & community", match: r("interview|maker|designer|community|podcast") },
    ],
  },
  environment: {
    key: "environment",
    label: "Environment",
    emoji: "🌎",
    blurb: "Climate science, energy, pollution and environmental research from specialist outlets.",
    cadence: "daily",
    fallbackCategory: "Environmental science",
    categories: [
      { name: "Renewable energy", match: r("solar|wind power|renewable|battery|clean energy|geothermal|hydrogen") },
      { name: "Environmental technology", match: r("technolog|satellite|sensor|\\bai\\b|carbon capture|electric") },
      { name: "Climate", match: r("climate|warming|emission|carbon|cop\\d|net zero|temperature") },
      { name: "Biodiversity", match: r("biodivers|species|ecosystem|extinct") },
      { name: "Pollution", match: r("pollut|plastic|toxic|air quality|waste") },
      { name: "Water & oceans", match: r("ocean|water|river|glacier|ice|sea level") },
    ],
  },
};

export const TOPIC_KEYS = Object.keys(TOPICS) as TopicKey[];

export function isTopicKey(v: string): v is TopicKey {
  return v in TOPICS;
}

export function categorize(topic: TopicKey, text: string): string {
  const t = TOPICS[topic];
  return t.categories.find((c) => c.match.test(text))?.name ?? t.fallbackCategory;
}

/**
 * Cross-topic tags. They power "Something We Both Might Like": an item is a
 * bridge when it carries a tag from the technology family and one from the
 * life-science / nature family.
 */
export const TAG_RULES: { tag: string; family: "mind" | "life"; match: RegExp }[] = [
  { tag: "ai", family: "mind", match: r("\\bai\\b|artificial intelligence|machine learning|deep learning|neural network|llm|language model|alphafold") },
  { tag: "software", family: "mind", match: r("software|algorithm|open.source|computational|bioinformatic|database|data science") },
  { tag: "computing", family: "mind", match: r("comput|quantum|chip|semiconductor|robot|drone|sensor|satellite") },
  { tag: "philosophy", family: "mind", match: r("ethic|philosoph|moral|conscious") },
  { tag: "biology", family: "life", match: r("biolog|biotech|genom|gene\\b|genes\\b|dna|protein|cell\\b|cells\\b|crispr|microb|enzyme") },
  { tag: "birds", family: "life", match: r("bird|avian|\\baves\\b|ornitholog") },
  { tag: "wildlife", family: "life", match: r("wildlife|species|animal|biodivers|ecolog|ecosystem|forest|ocean|coral|conservation") },
  { tag: "climate", family: "life", match: r("climate|greenhouse|emissions|carbon dioxide|renewable|environmental\\b|global warming") },
];

/** Every item also carries its topic's family tag, so e.g. biotech + an AI mention is a bridge. */
const TOPIC_TAG: Record<TopicKey, string> = {
  software: "software",
  technology: "computing",
  philosophy: "philosophy",
  nature: "wildlife",
  biotech: "biology",
  birds: "birds",
  knitting: "craft",
  environment: "climate",
};

export function tagsFor(topic: TopicKey, text: string): string[] {
  return [...new Set([topic, TOPIC_TAG[topic], ...TAG_RULES.filter((t) => t.match.test(text)).map((t) => t.tag)])];
}

export const MIND_TAGS = TAG_RULES.filter((t) => t.family === "mind").map((t) => t.tag);
export const LIFE_TAGS = TAG_RULES.filter((t) => t.family === "life").map((t) => t.tag);
