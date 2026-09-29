"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { citeNumber, withCitations } from "@/lib/research/cite";
import type { ResearchSource } from "@/lib/research/types";

/** An answer in Markdown, with [n] turned into links to the studies it cites. Raw HTML is never rendered. */
export function Answer({ text, sources, streaming = false }: { text: string; sources: ResearchSource[]; streaming?: boolean }) {
  const studies = new Map(sources.filter((s) => s.kind === "study" && s.n).map((s) => [s.n!, s]));
  const components: Components = {
    a({ href, children }) {
      const n = citeNumber(href);
      if (n !== null) {
        const s = studies.get(n);
        return s ? (
          <a href={s.uri} target="_blank" rel="noopener noreferrer" className="cite" title={`${s.title}${s.year ? ` (${s.year})` : ""}`} aria-label={`Study ${n}: ${s.title}`}>
            {n}
          </a>
        ) : (
          <span className="cite cite-dim">{n}</span>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto">
          <table>{children}</table>
        </div>
      );
    },
  };
  return (
    <div className={`prose-lux ${streaming ? "is-streaming" : ""}`}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {withCitations(text)}
      </Markdown>
    </div>
  );
}

/** The studies an answer read, as a strip of cards. */
export function StudyStrip({ items }: { items: ResearchSource[] }) {
  const studies = items.filter((s) => s.kind === "study");
  if (!studies.length) return null;
  return (
    <div className="mt-5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">
        {studies.length} {studies.length === 1 ? "study" : "studies"} read
      </p>
      <ol className="scrollbar-none -mx-4 mt-2.5 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1">
        {studies.map((s) => (
          <li key={s.uri} className="w-64 shrink-0 snap-start">
            <a href={s.uri} target="_blank" rel="noopener noreferrer" className="study-card group flex h-full flex-col rounded-2xl border border-line bg-surface p-3.5 transition hover:border-gold/60">
              <span className="flex items-center gap-2 text-[0.7rem] text-muted">
                <span className="grid size-5 place-items-center rounded-full bg-gold-soft text-[0.66rem] font-bold text-gold">{s.n}</span>
                <span className="truncate">{[s.year, s.venue].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="mt-2 line-clamp-3 text-[0.84rem] font-semibold leading-snug group-hover:underline">{s.title}</span>
              <span className="mt-auto flex items-center gap-2 pt-2 text-[0.7rem] text-muted">
                <span className="truncate">{s.authors || "—"}</span>
                {!!s.citations && <span className="ml-auto shrink-0">{s.citations.toLocaleString("en-GB")} cites</span>}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Web pages Google Search found for the answer. */
export function WebSources({ items }: { items: ResearchSource[] }) {
  const web = items.filter((s) => s.kind === "web");
  if (!web.length) return null;
  return (
    <div className="mt-5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">From the web</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {web.map((s) => (
          <li key={s.uri}>
            <a href={s.uri} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition hover:border-gold/60 hover:text-ink" title={s.title}>
              <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
              <span className="truncate">{s.domain || s.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Google's "Search suggestions" chips, which must be shown with answers
 * grounded in Google Search. Their HTML comes from Google; it's isolated in a
 * sandboxed frame without scripts, and links open in a new tab.
 */
export function SearchSuggestions({ html }: { html: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body>${html}</body></html>`;
  return <iframe title="Google Search suggestions" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" className="mt-4 h-[3.6rem] w-full rounded-xl" loading="lazy" />;
}
