/**
 * Remote images go through wsrv.nl, a free, open-source image CDN: it fetches
 * the original once, then serves a resized WebP from cache. A card that would
 * have pulled a 2 MB original loads ~30 KB instead.
 */
export function proxied(url: string, width: number): string {
  if (!/^https?:\/\//.test(url)) return url; // our own /api/… images are already sized
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=74&we&il`;
}

export function srcSet(url: string, widths = [360, 640, 960]): string | undefined {
  if (!/^https?:\/\//.test(url)) return undefined;
  return widths.map((w) => `${proxied(url, w)} ${w}w`).join(", ");
}
