/** Research shapes shared by the API and the page (safe to import on the client). */
import type { ResearchSource } from "@/lib/db/schema";

export type { ResearchSource };
export type ResearchMode = "research" | "learn" | "explain";

export type ThreadSummary = { id: string; title: string; mode: ResearchMode; shared: boolean; mine: boolean; ownerSlug: string; updatedAt: string };

export type ResearchMessage = {
  id: number;
  role: "user" | "model";
  content: string;
  sources: ResearchSource[];
  queries: string[];
  followUps: string[];
  searchWidget: string | null;
  model: string | null;
  grounded: boolean;
  createdAt: string;
};

export type ThreadView = ThreadSummary & { messages: ResearchMessage[] };

export type StreamEvent =
  | { t: "thread"; thread: ThreadSummary }
  | { t: "status"; text: string }
  | { t: "studies"; items: ResearchSource[] }
  | { t: "delta"; text: string }
  | { t: "done"; message: ResearchMessage }
  | { t: "error"; message: string; retry?: boolean };

export type Quiz = { questions: { question: string; options: string[]; answer: number; explanation: string }[] };
