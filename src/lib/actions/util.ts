import "server-only";
import { z } from "zod";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

/** Reads a FormData into a plain object, turning "" into undefined. */
export function formObject(fd: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    out[k] = t === "" ? undefined : t;
  }
  return out;
}

export const optText = (max = 4000) => z.string().max(max).optional();
export const reqText = (max = 300) => z.string({ error: "Required" }).min(1, "Required").max(max);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");
export const optUrl = z
  .string()
  .max(1000)
  .refine((v) => /^https?:\/\//i.test(v), "Must start with http:// or https://")
  .optional();
export const visibilityField = z.enum(["private", "shared", "public"]).default("shared");

/** "a, b ,c" → ["a","b","c"], lower-cased for tags. */
export function list(v: string | undefined, lower = false): string[] {
  if (!v) return [];
  return [...new Set(v.split(",").map((s) => (lower ? s.trim().toLowerCase() : s.trim())).filter(Boolean))].slice(0, 30);
}

export function firstError(e: z.ZodError): string {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "Input"}: ${i.message}` : "Invalid input";
}

export const today = () => new Date().toISOString().slice(0, 10);
