/**
 * Answers cite studies as [1], [2, 3] or [1–3]. Before rendering, each number
 * becomes a Markdown link to "#cite-n", which the page turns into a small
 * link to that study. Existing links like [text](url) and [1]: definitions
 * are left alone. Safe to import on the client.
 */
export function withCitations(text: string): string {
  return text.replace(/\[(\d{1,2}(?:\s*[,–-]\s*\d{1,2})*)\](?!\()/g, (whole, inner: string, at: number) => {
    // "[1]: https://…" at the start of a line is a link definition, not a citation.
    if (text[at + whole.length] === ":" && (at === 0 || text[at - 1] === "\n")) return whole;
    const nums: number[] = [];
    for (const part of inner.split(",")) {
      const [a, b] = part.split(/[–-]/).map((x) => Number(x.trim()));
      if (b === undefined) nums.push(a);
      else if (b >= a && b - a < 10) for (let n = a; n <= b; n++) nums.push(n);
      else return whole;
    }
    return nums.map((n) => `[${n}](#cite-${n})`).join("");
  });
}

export const citeNumber = (href: string | undefined): number | null => {
  const m = href?.match(/^#cite-(\d{1,2})$/);
  return m ? Number(m[1]) : null;
};
