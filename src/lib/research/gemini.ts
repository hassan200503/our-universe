import "server-only";
import { readSecret, SECRET_GEMINI } from "@/lib/settings";

/**
 * A small client for the Gemini API (generativelanguage.googleapis.com).
 *
 * Free-tier keys see every kind of trouble: a model "at capacity" (503), out
 * of per-minute quota (429), or so loaded it takes half a minute to say its
 * first word. So requests are hedged: the first model gets a few seconds'
 * head start, then the next joins the race, and whichever starts answering
 * first wins (the rest are cancelled). Models that fail or lose while slow
 * rest at the back of the queue for a while. Answers grounded in Google
 * Search are tried first; if the key can't use Search right now, the models
 * answer from the studies we found and their own knowledge, and say so.
 */
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
export const MODELS = (process.env.GEMINI_MODELS || "gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3.8-flash,gemini-flash-latest,gemini-flash-lite-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: "no-key" | "bad-key" | "busy" | "quota" | "blocked" | "failed",
  ) {
    super(message);
  }
}

export async function geminiKey(): Promise<string | null> {
  return process.env.GEMINI_API_KEY || (await readSecret<string>(SECRET_GEMINI));
}

export type Content = { role: "user" | "model"; parts: { text: string }[] };
export type Grounding = {
  webSearchQueries?: string[];
  searchEntryPoint?: { renderedContent?: string };
  groundingChunks?: { web?: { uri?: string; title?: string } }[];
};
type Chunk = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string; groundingMetadata?: Grounding }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
};

async function explain(res: Response): Promise<GeminiError> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  const msg = body?.error?.message ?? "";
  if ((res.status === 400 && /api key/i.test(msg)) || res.status === 401) return new GeminiError("The Gemini API key was refused. Check it in Settings → AI research.", "bad-key");
  // A 403 about the key or the API as a whole ends the search; one about a single model just moves on to the next.
  if (res.status === 403 && /api key|service|disabled|has not been used|blocked|referer|ip address/i.test(msg)) return new GeminiError("This Gemini API key isn't allowed to use the Gemini API.", "bad-key");
  if (res.status === 429) return new GeminiError("The free Gemini quota is used up for the moment. Try again in a minute.", "quota");
  if (res.status === 503 || res.status === 500 || res.status === 504) return new GeminiError("Gemini is very busy right now. Try again in a moment.", "busy");
  return new GeminiError(`Gemini couldn't answer (${res.status}).`, "failed");
}

type Attempt = { model: string; grounded: boolean };

/** A model that failed, or lost a race while slow, goes to the back of the queue for a while. */
const cooling = new Map<string, number>();
function cool(model: string, err: GeminiError | "slow") {
  cooling.set(model, Date.now() + (err === "slow" ? 10 * 60_000 : err.kind === "failed" ? 10 * 60_000 : 60_000));
}
function modelOrder(): string[] {
  const now = Date.now();
  return [...MODELS.filter((m) => (cooling.get(m) ?? 0) <= now), ...MODELS.filter((m) => (cooling.get(m) ?? 0) > now)];
}

/** When Search grounding was refused for quota, skip it for a while instead of paying for the refusal on every question. */
let groundingPausedUntil = 0;
const GROUNDING_PAUSE_MS = 15 * 60_000;

// Gemini 3 models think before answering; a little thinking keeps answers careful without long silences.
const thinking = (model: string) => (/^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {});

const MAX_PARALLEL = 3;

/**
 * Runs attempts as a hedged race (see the top of this file). `take` turns a
 * successful response into the result, or throws a GeminiError to move on.
 */
function race<T>(
  queue: Attempt[],
  send: (a: Attempt, signal: AbortSignal) => Promise<Response>,
  take: (a: Attempt, res: Response) => Promise<T>,
  { hedgeMs, budgetMs }: { hedgeMs: number; budgetMs: number },
): Promise<{ attempt: Attempt; value: T }> {
  return new Promise((resolve, reject) => {
    const live = new Map<AbortController, { attempt: Attempt; started: number }>();
    let done = false;
    let last = new GeminiError("Gemini couldn't answer right now. Try again in a moment.", "busy");
    let hedge: ReturnType<typeof setTimeout> | undefined;
    const end = (settle: () => void, keep?: AbortController) => {
      if (done) return;
      done = true;
      clearTimeout(hedge);
      clearTimeout(budget);
      for (const c of live.keys()) if (c !== keep) c.abort();
      settle();
    };
    const budget = setTimeout(() => end(() => reject(new GeminiError("Gemini is taking too long right now. Try again in a moment.", "busy"))), budgetMs);
    const next = () => {
      clearTimeout(hedge);
      if (done) return;
      const attempt = queue.shift();
      if (!attempt) {
        if (live.size === 0) end(() => reject(last));
        return;
      }
      const ctl = new AbortController();
      const started = Date.now();
      live.set(ctl, { attempt, started });
      if (live.size < MAX_PARALLEL) hedge = setTimeout(next, hedgeMs);
      void (async () => {
        try {
          const res = await send(attempt, ctl.signal);
          if (done) return ctl.abort();
          if (!res.ok || !res.body) throw await explain(res);
          const value = await take(attempt, res);
          if (done) return ctl.abort();
          // Anything still waiting that started before the winner is slow right now: let it rest.
          for (const [c, l] of live) if (c !== ctl && l.started < started) cool(l.attempt.model, "slow");
          end(() => resolve({ attempt, value }), ctl);
        } catch (e) {
          live.delete(ctl);
          if (done) return;
          const err = e instanceof GeminiError ? e : new GeminiError("Couldn't reach Gemini. Try again in a moment.", "busy");
          if (err.kind === "bad-key") return end(() => reject(err));
          last = err;
          if (attempt.grounded && err.kind === "quota") {
            // Search isn't available on this key right now (a grounded 429 is about Search, not the model): answer without it.
            groundingPausedUntil = Date.now() + GROUNDING_PAUSE_MS;
            for (let i = queue.length - 1; i >= 0; i--) if (queue[i].grounded) queue.splice(i, 1);
          } else cool(attempt.model, err);
          next();
        }
      })();
    };
    next();
  });
}

/** Opens a streamed answer; resolves as soon as one model starts writing. The caller reads `events`. */
export async function openStream(opts: { system: string; contents: Content[]; ground: boolean; maxTokens?: number }): Promise<{ attempt: Attempt; events: AsyncGenerator<Chunk> }> {
  const key = await geminiKey();
  if (!key) throw new GeminiError("Add a Gemini API key in Settings → AI research to switch research on.", "no-key");
  const ground = opts.ground && Date.now() >= groundingPausedUntil;
  const models = modelOrder();
  const queue: Attempt[] = [...(ground ? models.map((model) => ({ model, grounded: true })) : []), ...models.map((model) => ({ model, grounded: false }))];
  const { attempt, value } = await race(
    queue,
    (a, signal) =>
      fetch(`${BASE}/models/${a.model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: opts.contents,
          ...(a.grounded ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: { temperature: 0.4, maxOutputTokens: opts.maxTokens ?? 4096, ...thinking(a.model) },
        }),
        signal,
      }),
    async (_, res) => sse(res.body!),
    // Leaves time to write the whole answer inside the function's time limit.
    { hedgeMs: 4500, budgetMs: 30_000 },
  );
  return { attempt, events: value };
}

const IDLE_MS = 20_000;

/** Server-sent events → parsed JSON chunks. A stream that goes quiet for 20 seconds is given up on. */
async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parse = (block: string): Chunk | null => {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!data) return null;
    try {
      return JSON.parse(data) as Chunk;
    } catch {
      return null; // a keep-alive or a malformed event
    }
  };
  let buf = "";
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const idle = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GeminiError("Gemini stopped answering part-way. Try again.", "busy")), IDLE_MS);
      });
      let step: ReadableStreamReadResult<Uint8Array>;
      try {
        step = await Promise.race([reader.read(), idle]);
      } finally {
        clearTimeout(timer);
      }
      if (step.done) break;
      buf += decoder.decode(step.value, { stream: true });
      let cut: number;
      while ((cut = buf.search(/\r?\n\r?\n/)) >= 0) {
        const chunk = parse(buf.slice(0, cut));
        buf = buf.slice(cut).replace(/^\r?\n\r?\n/, "");
        if (chunk) yield chunk;
      }
    }
    const tail = parse(buf + decoder.decode());
    if (tail) yield tail;
  } finally {
    // Finished, failed, or the reader left early (the page was closed): let go of the connection.
    reader.cancel().catch(() => {});
  }
}

export function textOf(chunk: Chunk): string {
  return (chunk.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
}

/** A structured (JSON) answer, used for quizzes. Same hedged race, no streaming. */
export async function generateJson<T>(opts: { system: string; prompt: string; schema: object }): Promise<T> {
  const key = await geminiKey();
  if (!key) throw new GeminiError("Add a Gemini API key in Settings → AI research.", "no-key");
  const { value } = await race(
    modelOrder().map((model) => ({ model, grounded: false })),
    (a, signal) =>
      fetch(`${BASE}/models/${a.model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
          generationConfig: { temperature: 0.5, responseMimeType: "application/json", responseSchema: opts.schema, ...thinking(a.model) },
        }),
        signal,
      }),
    async (_, res) => {
      try {
        return JSON.parse(textOf((await res.json()) as Chunk)) as T;
      } catch {
        throw new GeminiError("Gemini's answer couldn't be read. Try again.", "failed");
      }
    },
    { hedgeMs: 8000, budgetMs: 50_000 },
  );
  return value;
}

/** Checks a key before it's saved. */
export async function testKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE}/models?pageSize=1`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { ok: true, message: "Key accepted by Gemini." };
    const err = await explain(res);
    return { ok: err.kind !== "bad-key", message: err.message };
  } catch {
    return { ok: true, message: "Saved. Gemini couldn't be reached to check the key just now." };
  }
}
