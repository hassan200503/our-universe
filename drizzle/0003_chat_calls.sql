CREATE TABLE "call_signals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"call_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"caller_id" uuid NOT NULL,
	"callee_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'calling' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_by" uuid,
	"caller_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"callee_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_state" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"relationship_id" uuid NOT NULL,
	"last_read_id" bigint DEFAULT 0 NOT NULL,
	"last_delivered_id" bigint DEFAULT 0 NOT NULL,
	"typing_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"relationship_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"client_id" text,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"reply_to_id" bigint,
	"meta" jsonb,
	"reactions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hidden_for" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deleted_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "call_signals" ADD CONSTRAINT "call_signals_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_signals" ADD CONSTRAINT "call_signals_from_id_people_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_people_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_id_people_id_fk" FOREIGN KEY ("callee_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_state" ADD CONSTRAINT "chat_state_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_state" ADD CONSTRAINT "chat_state_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_people_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_signals_call_id" ON "call_signals" USING btree ("call_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_one_live" ON "calls" USING btree ("relationship_id") WHERE status in ('calling', 'ringing', 'active');--> statement-breakpoint
CREATE INDEX "calls_rel_created" ON "calls" USING btree ("relationship_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_rel_id" ON "messages" USING btree ("relationship_id","id");--> statement-breakpoint
CREATE INDEX "messages_rel_updated" ON "messages" USING btree ("relationship_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_rel_client" ON "messages" USING btree ("relationship_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_endpoint" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_person" ON "push_subscriptions" USING btree ("person_id");--> statement-breakpoint
INSERT INTO "messages" ("relationship_id", "sender_id", "kind", "body", "created_at", "updated_at")
SELECT "relationship_id", "person_id", 'text', "body", "created_at", "created_at" FROM "room_events" WHERE "kind" = 'chat' ORDER BY "id";
