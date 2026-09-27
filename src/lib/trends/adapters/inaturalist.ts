import type { INatSource } from "../sources";
import { type AdapterResult, type NormalizedItem, SourceError, USER_AGENT, excerpt } from "./types";

/**
 * Recent research-grade observations from iNaturalist, limited to photos under
 * licences that allow reuse with attribution. Facts come from the Wikipedia
 * summary iNaturalist attaches to each taxon.
 *
 * iNaturalist asks API users to stay around one request per second, so a run
 * makes exactly two requests per source.
 */

const API = "https://api.inaturalist.org/v1";
const LICENSES = "cc0,cc-by,cc-by-sa,cc-by-nc,cc-by-nc-sa";

type Obs = {
  id: number;
  uri: string;
  observed_on: string | null;
  created_at: string;
  updated_at: string;
  place_guess: string | null;
  user?: { login: string; name?: string | null };
  photos: { url: string; license_code: string | null; attribution: string }[];
  sounds?: { file_url: string; license_code: string | null; attribution: string; file_content_type?: string }[];
  taxon?: {
    id: number;
    name: string;
    rank: string;
    preferred_common_name?: string;
    iconic_taxon_name?: string;
    conservation_status?: { status_name?: string; status?: string; authority?: string } | null;
    wikipedia_url?: string | null;
    default_photo?: { medium_url: string; license_code: string | null; attribution: string } | null;
  };
};

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch (e) {
    throw new SourceError(`Network error: ${String(e)}`);
  }
  if (!res.ok) {
    const ra = Number(res.headers.get("retry-after"));
    throw new SourceError(`HTTP ${res.status}`, res.status, Number.isFinite(ra) && ra > 0 ? ra : undefined);
  }
  return (await res.json()) as T;
}

/** Keep only the coarse end of a place name ("Mara, Kenya"), never a street. */
function coarsePlace(guess: string | null): string | null {
  if (!guess) return null;
  const parts = guess.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.slice(-2).join(", ") || null;
}

/** "rüppell's griffon" → "Rüppell's Griffon"; never capitalises after an apostrophe. */
function titleCase(name: string): string {
  return name.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

const LICENSE_LABEL: Record<string, string> = {
  cc0: "CC0",
  "cc-by": "CC BY 4.0",
  "cc-by-sa": "CC BY-SA 4.0",
  "cc-by-nc": "CC BY-NC 4.0",
  "cc-by-nc-sa": "CC BY-NC-SA 4.0",
};

export async function fetchINat(source: INatSource): Promise<AdapterResult> {
  const qs = new URLSearchParams({
    place_id: String(source.placeId),
    iconic_taxa: source.iconicTaxa.join(","),
    quality_grade: "research",
    ...(source.sounds ? { sounds: "true", sound_license: LICENSES } : { photos: "true", photo_license: LICENSES }),
    order_by: "created_at",
    order: "desc",
    per_page: String(source.perPage ?? 40),
    locale: "en",
  });
  const data = await getJson<{ results: Obs[] }>(`${API}/observations?${qs}`);
  const obs = data.results.filter((o) => o.taxon && o.taxon.rank === "species" && (source.sounds ? o.sounds?.[0] : o.photos[0]));

  const taxonIds = [...new Set(obs.map((o) => o.taxon!.id))].slice(0, 30);
  const facts = new Map<number, string>();
  if (taxonIds.length) {
    try {
      const taxa = await getJson<{ results: { id: number; wikipedia_summary?: string | null }[] }>(`${API}/taxa/${taxonIds.join(",")}?locale=en`);
      for (const t of taxa.results) if (t.wikipedia_summary) facts.set(t.id, t.wikipedia_summary);
    } catch {
      // Facts are a nice-to-have; sightings are still worth showing without them.
    }
  }

  // One card per species per run: a burst of the same bird isn't discovery.
  const seen = new Set<number>();
  const items: NormalizedItem[] = [];
  for (const o of obs) {
    const t = o.taxon!;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    // A sighting's own photo when licensed for reuse; otherwise the species' default photo, also CC-licensed.
    const own = o.photos.find((p) => p.license_code);
    const fallback = t.default_photo?.license_code ? t.default_photo : null;
    const photo = own ? { url: own.url, license_code: own.license_code, attribution: own.attribution } : fallback ? { url: fallback.medium_url, license_code: fallback.license_code, attribution: fallback.attribution } : null;
    const sound = source.sounds ? o.sounds?.find((x) => x.license_code) : undefined;
    if (source.sounds && !sound) continue;
    const common = titleCase(t.preferred_common_name ?? t.name);
    const fact = excerpt(facts.get(t.id), 320);
    const status = t.conservation_status?.status_name ?? null;
    const place = coarsePlace(o.place_guess);
    items.push({
      title: common,
      summary: fact,
      author: o.user?.login ?? null,
      url: o.uri,
      publishedAt: new Date(o.created_at),
      sourceUpdatedAt: new Date(o.updated_at),
      imageUrl: photo ? photo.url.replace("/square.", "/medium.") : null,
      imageCredit: photo?.attribution ?? null,
      imageLicense: photo?.license_code ? (LICENSE_LABEL[photo.license_code] ?? photo.license_code.toUpperCase()) : null,
      contentType: sound ? "sound" : "observation",
      extra: {
        commonName: common,
        scientificName: t.name,
        observedOn: o.observed_on ?? undefined,
        place: place ?? undefined,
        conservationStatus: status ? status.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined,
        conservationAuthority: t.conservation_status?.authority ?? undefined,
        fact: fact ?? undefined,
        factSource: fact ? "Wikipedia" : undefined,
        factUrl: t.wikipedia_url ?? undefined,
        observer: o.user?.login,
        iconicTaxon: t.iconic_taxon_name,
        imageOrigin: photo ? "licensed" : undefined,
        ...(sound
          ? { audioUrl: sound.file_url, audioCredit: sound.attribution, audioLicense: sound.license_code ? (LICENSE_LABEL[sound.license_code] ?? sound.license_code.toUpperCase()) : undefined }
          : {}),
      },
      ruleHints: `${sound ? "sound" : "observation"}: ${t.iconic_taxon_name ?? ""}`,
    });
  }
  return { status: "ok", items, etag: null, lastModified: null };
}
