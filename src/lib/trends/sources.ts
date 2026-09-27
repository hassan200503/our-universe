import type { TopicKey } from "./topics";

/**
 * Source registry. Every feed here was checked on 2026-09-27 to respond with
 * current items. To add a source, append an entry: the adapter, normaliser,
 * deduplication and frontend all work unchanged.
 *
 * `tier` follows the source-quality order: 1 official organisation,
 * 2 university, 3 research institution, 4 scientific publication,
 * 5 government, 6 established tech publication, 7 industry publication,
 * 8 high-quality open-source / project source. Lower is weighted higher.
 *
 * Images: we show the image a publisher puts in its own feed, or the article's
 * preview image (the one link previews use), hotlinked through an image CDN
 * with the source credited, never re-hosted. iNaturalist photos and sounds
 * carry their own Creative Commons licence and credit.
 */

export type RssSource = {
  key: string;
  kind: "rss";
  name: string;
  url: string;
  topic: TopicKey;
  tier: number;
  thumbnails: boolean;
  /** Minutes between fetches. */
  every: number;
  /** Keep only items whose URL matches (e.g. Interweave's knitting section). */
  include?: RegExp;
  /** Keep only items mentioning the topic (for broad feeds). */
  requireKeywords?: RegExp;
};

export type INatSource = {
  key: string;
  kind: "inaturalist";
  name: string;
  topic: TopicKey;
  tier: number;
  thumbnails: true;
  every: number;
  /** iNaturalist place id: 7042 is Kenya. */
  placeId: number;
  iconicTaxa: string[];
  /** Fetch recordings instead of photos (bird songs). */
  sounds?: boolean;
  perPage?: number;
};

export type SourceDef = RssSource | INatSource;

const rss = (
  key: string,
  name: string,
  url: string,
  topic: TopicKey,
  tier: number,
  opts: { thumbnails?: boolean; every?: number; include?: RegExp; requireKeywords?: RegExp } = {},
): RssSource => ({ key, kind: "rss", name, url, topic, tier, thumbnails: opts.thumbnails ?? true, every: opts.every ?? 60, include: opts.include, requireKeywords: opts.requireKeywords });

const yt = (key: string, name: string, channelId: string, topic: TopicKey, every = 360) =>
  rss(key, `${name} · YouTube`, `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, topic, 7, { every });

const BIRD_WORDS = /\b(birds?|avian|songbirds?|raptors?|eagles?|owls?|hawks?|falcons?|parrots?|penguins?|pigeons?|flamingos?|cranes?|herons?|finch(es)?|sparrows?|crows?|ravens?|warblers?|hummingbirds?|seabirds?|waterfowl|ducks?|geese|goose|vultures?|kingfishers?|weavers?|ornitholog\w*|migrat\w*|nest(s|ing)?|feathers?|flocks?)\b/i;

export const SOURCES: SourceDef[] = [
  // 💻 Software engineering
  rss("infoq", "InfoQ", "https://www.infoq.com/feed/", "software", 6),
  rss("inside-java", "Inside Java (Oracle)", "https://inside.java/feed.xml", "software", 1),
  rss("spring", "Spring Blog", "https://spring.io/blog.atom", "software", 8),
  rss("fowler", "Martin Fowler", "https://martinfowler.com/feed.atom", "software", 7, { every: 180 }),
  rss("github-blog", "The GitHub Blog", "https://github.blog/feed/", "software", 8),
  rss("jetbrains-idea", "IntelliJ IDEA Blog", "https://blog.jetbrains.com/idea/feed/", "software", 8, { every: 180 }),
  rss("stackoverflow", "Stack Overflow Blog", "https://stackoverflow.blog/feed/", "software", 7),
  rss("netflix-tech", "Netflix Technology Blog", "https://netflixtechblog.com/feed", "software", 7, { every: 180 }),
  rss("cloudflare", "The Cloudflare Blog", "https://blog.cloudflare.com/rss/", "software", 7),

  // ⚡ Technology
  rss("mit-tr", "MIT Technology Review", "https://www.technologyreview.com/feed/", "technology", 2),
  rss("ieee-spectrum", "IEEE Spectrum", "https://spectrum.ieee.org/feeds/feed.rss", "technology", 3),
  rss("ars-tech", "Ars Technica", "https://feeds.arstechnica.com/arstechnica/technology-lab", "technology", 6),
  rss("techcrunch", "TechCrunch", "https://techcrunch.com/feed/", "technology", 6, { every: 30 }),
  rss("wired", "WIRED", "https://www.wired.com/feed/rss", "technology", 6),

  // 🧠 Ideas & philosophy
  rss("sep", "Stanford Encyclopedia of Philosophy", "https://plato.stanford.edu/rss/sep.xml", "philosophy", 2, { every: 360 }),
  rss("aeon", "Aeon", "https://aeon.co/feed.rss", "philosophy", 7, { every: 180 }),
  rss("psyche", "Psyche", "https://psyche.co/feed.rss", "philosophy", 7, { every: 180 }),
  rss("daily-nous", "Daily Nous", "https://dailynous.com/feed/", "philosophy", 7, { every: 180 }),
  rss("philosophy-now", "Philosophy Now", "https://www.philosophynow.org/rss", "philosophy", 7, { every: 720 }),

  // 🌿 Nature (shared)
  rss("nasa-eo", "NASA Earth Observatory", "https://earthobservatory.nasa.gov/feeds/earth-observatory.rss", "nature", 5, { thumbnails: true, every: 180 }),
  rss("mongabay", "Mongabay", "https://news.mongabay.com/feed/", "nature", 7),
  {
    key: "inat-kenya-nature",
    kind: "inaturalist",
    name: "iNaturalist",
    topic: "nature",
    tier: 3,
    thumbnails: true,
    every: 60,
    placeId: 7042,
    iconicTaxa: ["Mammalia", "Plantae", "Reptilia", "Insecta", "Amphibia", "Fungi"],
  },

  // 🧬 Biotechnology
  rss("nature-biotech", "Nature Biotechnology", "https://www.nature.com/nbt.rss", "biotech", 4, { every: 360 }),
  rss("sd-biotech", "ScienceDaily · Biotechnology", "https://www.sciencedaily.com/rss/plants_animals/biotechnology.xml", "biotech", 4),
  rss("sd-genetics", "ScienceDaily · Genetics", "https://www.sciencedaily.com/rss/plants_animals/genetics.xml", "biotech", 4),
  rss("gen", "GEN – Genetic Engineering & Biotechnology News", "https://www.genengnews.com/feed/", "biotech", 7),
  rss("stat-biotech", "STAT", "https://www.statnews.com/category/biotech/feed/", "biotech", 6),
  rss("phys-biotech", "Phys.org · Biotechnology", "https://phys.org/rss-feed/biology-news/biotechnology/", "biotech", 6),

  // 🐦 Birds
  {
    key: "inat-kenya-birds",
    kind: "inaturalist",
    name: "iNaturalist",
    topic: "birds",
    tier: 3,
    thumbnails: true,
    every: 30,
    placeId: 7042,
    iconicTaxa: ["Aves"],
  },
  rss("audubon", "Audubon", "https://www.audubon.org/rss.xml", "birds", 1, { every: 180 }),
  rss("birdlife", "BirdLife International", "https://www.birdlife.org/feed/", "birds", 1, { every: 360 }),
  rss("sd-birds", "ScienceDaily · Birds", "https://www.sciencedaily.com/rss/plants_animals/birds.xml", "birds", 4, { every: 180, requireKeywords: BIRD_WORDS }),
  rss("nature-kenya", "Nature Kenya", "https://naturekenya.org/feed/", "birds", 1, { every: 720 }),
  rss("birdwatching", "BirdWatching", "https://www.birdwatchingdaily.com/feed/", "birds", 7, { every: 360 }),
  rss("10000birds", "10,000 Birds", "https://www.10000birds.com/feed", "birds", 7, { every: 360 }),
  rss("bto", "British Trust for Ornithology", "https://www.bto.org/rss.xml", "birds", 3, { every: 720, requireKeywords: BIRD_WORDS }),
  yt("yt-birdlife", "BirdLife International", "UC6Bo5Wr8yPUkleeZaaRzhdg", "birds", 720),
  {
    key: "inat-kenya-bird-songs",
    kind: "inaturalist",
    name: "iNaturalist · Bird songs",
    topic: "birds",
    tier: 3,
    thumbnails: true,
    every: 180,
    placeId: 7042,
    iconicTaxa: ["Aves"],
    sounds: true,
  },
  {
    key: "inat-africa-bird-songs",
    kind: "inaturalist",
    name: "iNaturalist · Bird songs of Africa",
    topic: "birds",
    tier: 3,
    thumbnails: true,
    every: 240,
    placeId: 97392,
    iconicTaxa: ["Aves"],
    sounds: true,
  },
  {
    key: "inat-africa-birds",
    kind: "inaturalist",
    name: "iNaturalist · Birds of Africa",
    topic: "birds",
    tier: 3,
    thumbnails: true,
    every: 60,
    placeId: 97392,
    iconicTaxa: ["Aves"],
  },

  // 🧶 Knitting
  rss("mdk", "Modern Daily Knitting", "https://www.moderndailyknitting.com/feed/", "knitting", 7, { every: 360 }),
  rss("interweave", "Interweave", "https://www.interweave.com/feed/", "knitting", 7, { every: 360, include: /\/article\/knitting\//i }),
  rss("tincan", "Tin Can Knits", "https://blog.tincanknits.com/feed/", "knitting", 7, { every: 720 }),
  rss("knitting-and", "Knitting-and.com", "https://www.knitting-and.com/feed", "knitting", 7, { every: 720 }),
  rss("ravelry", "Ravelry Blog", "https://blog.ravelry.com/feed/", "knitting", 8, { every: 720 }),
  rss("ysolda", "Ysolda", "https://www.ysolda.com/blogs/journal.atom", "knitting", 7, { every: 720 }),
  rss("nimble-needles", "Nimble Needles", "https://www.nimble-needles.com/feed/", "knitting", 7, { every: 720 }),
  rss("reddit-knitting", "r/knitting", "https://www.reddit.com/r/knitting/top/.rss?t=day", "knitting", 8, { every: 180 }),
  yt("yt-verypink", "VeryPink Knits", "UCrRT4LwemxYrZxj-HeCkK9Q", "knitting"),
  yt("yt-nimble", "Nimble Needles", "UCsAIlWdyXrLE1hgujwNkHGg", "knitting"),
  yt("yt-sheepstitch", "Sheep & Stitch", "UCXK_Yw8hCF-9oeccQP9Gs2g", "knitting"),
  yt("yt-purlsoho", "Purl Soho", "UCD4aGdwvTeu8c3E9n2RBpCg", "knitting"),
  yt("yt-arnecarlos", "ARNE & CARLOS", "UCswHDKvVlidNa02Y_T0D1Zw", "knitting"),
  yt("yt-roxanne", "Roxanne Richardson", "UCSPrWB2SZXVCj2-PH-36xBA", "knitting"),

  // 🌎 Environment
  rss("carbon-brief", "Carbon Brief", "https://www.carbonbrief.org/feed/", "environment", 7),
  rss("yale-e360", "Yale Environment 360", "https://e360.yale.edu/feed.xml", "environment", 2, { every: 180 }),
  rss("sd-envsci", "ScienceDaily · Environmental Science", "https://www.sciencedaily.com/rss/earth_climate/environmental_science.xml", "environment", 4),
];

export const SOURCE_BY_KEY = new Map(SOURCES.map((s) => [s.key, s]));
