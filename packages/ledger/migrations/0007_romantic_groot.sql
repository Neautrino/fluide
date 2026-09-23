-- SOURCE OF TRUTH: review_queue table for S1-4's confidence gate.
-- WHAT: creates review_queue_status enum + review_queue table.
-- WHY: Tier 2/3 matches that fail the auto-apply checklist land here
-- instead of writing postings.category_id directly.
-- WHERE: table shape mirrors schema.ts.

CREATE TYPE "public"."review_queue_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"posting_id" uuid NOT NULL,
	"suggested_category_id" uuid NOT NULL,
	"source" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" "review_queue_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_posting_id_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_suggested_category_id_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_queue_status_idx" ON "review_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_queue_posting_idx" ON "review_queue" USING btree ("posting_id");