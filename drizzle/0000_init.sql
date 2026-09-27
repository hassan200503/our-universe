CREATE TABLE "interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"space" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"source" text,
	"url" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"trend_id" uuid,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"occurred_on" date NOT NULL,
	"category" text,
	"technology" text,
	"difficulty" text,
	"status" text DEFAULT 'in-progress' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text,
	"notes" text,
	"project_id" uuid,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"kind" text DEFAULT 'memory' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"why" text,
	"occurred_on" date NOT NULL,
	"photo_url" text,
	"place" text,
	"plan_done" boolean DEFAULT false NOT NULL,
	"trend_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"nickname" text,
	"headline" text,
	"course" text,
	"focus" text,
	"intro" text,
	"motto" text,
	"theme" text NOT NULL,
	"journal_title" text DEFAULT 'Learning Journey' NOT NULL,
	"radar_title" text DEFAULT 'Radar' NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"public_profile" boolean DEFAULT false NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"favorite_topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"blocked_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"blocked_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"muted_sources" text[] DEFAULT '{}'::text[] NOT NULL,
	"saved_sources" text[] DEFAULT '{}'::text[] NOT NULL,
	"digest_frequency" text DEFAULT 'weekly' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"problem" text,
	"stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"architecture" text,
	"status" text DEFAULT 'building' NOT NULL,
	"screenshots" text[] DEFAULT '{}'::text[] NOT NULL,
	"repo_url" text,
	"live_url" text,
	"lessons" text,
	"improvements" text,
	"started_on" date,
	"current" boolean DEFAULT false NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"lane_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_lanes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_members" (
	"relationship_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "relationship_members_relationship_id_person_id_pk" PRIMARY KEY("relationship_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"started_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_discoveries" (
	"person_id" uuid NOT NULL,
	"trend_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_discoveries_person_id_trend_id_kind_pk" PRIMARY KEY("person_id","trend_id","kind")
);
--> statement-breakpoint
CREATE TABLE "shared_learning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"title" text NOT NULL,
	"topic" text,
	"notes" text,
	"source" text,
	"url" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"level" integer NOT NULL,
	"evidence" text,
	"primary" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_sources" (
	"key" text PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"next_fetch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"etag" text,
	"last_modified" text,
	"items_stored" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"topic" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"author" text,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_updated_at" timestamp with time zone,
	"image_url" text,
	"image_credit" text,
	"image_license" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"relevance" real DEFAULT 0.5 NOT NULL,
	"content_type" text DEFAULT 'article' NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_added_by_people_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_items" ADD CONSTRAINT "radar_items_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_items" ADD CONSTRAINT "radar_items_lane_id_radar_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."radar_lanes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_lanes" ADD CONSTRAINT "radar_lanes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_members" ADD CONSTRAINT "relationship_members_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_members" ADD CONSTRAINT "relationship_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_discoveries" ADD CONSTRAINT "saved_discoveries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_discoveries" ADD CONSTRAINT "saved_discoveries_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_learning" ADD CONSTRAINT "shared_learning_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_learning" ADD CONSTRAINT "shared_learning_added_by_people_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interests_person_topic" ON "interests" USING btree ("person_id","topic");--> statement-breakpoint
CREATE INDEX "knowledge_person_space" ON "knowledge_entries" USING btree ("person_id","space","created_at");--> statement-breakpoint
CREATE INDEX "learning_person_date" ON "learning_records" USING btree ("person_id","occurred_on");--> statement-breakpoint
CREATE INDEX "memories_rel_date" ON "memories" USING btree ("relationship_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "trends_dedupe" ON "trends" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "trends_topic_published" ON "trends" USING btree ("topic","published_at","id");--> statement-breakpoint
CREATE INDEX "trends_published" ON "trends" USING btree ("published_at","id");