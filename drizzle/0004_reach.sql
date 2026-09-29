ALTER TABLE "calls" ADD COLUMN "pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "push_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "relationships" SET "started_on" = ("started_on" + interval '2 years')::date WHERE extract(year from "started_on") = 2024;--> statement-breakpoint
UPDATE "relationships" SET "started_on" = '2026-02-14' WHERE "started_on" IS NULL;
