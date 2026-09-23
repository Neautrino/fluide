CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"primary" text NOT NULL,
	"detailed" text NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"category_id" uuid NOT NULL,
	"is_user_custom" boolean DEFAULT true NOT NULL,
	"confidence_learned" numeric(4, 3),
	"times_matched" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_tenant_idx" ON "categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "categories_primary_idx" ON "categories" USING btree ("primary");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_system_detailed_unique_idx" ON "categories" USING btree ("detailed") WHERE "categories"."tenant_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_detailed_unique_idx" ON "categories" USING btree ("tenant_id","detailed") WHERE "categories"."tenant_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "categorization_rules_tenant_idx" ON "categorization_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_pattern_idx" ON "categorization_rules" USING btree ("pattern");--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;