CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'income', 'expense', 'equity');--> statement-breakpoint
CREATE TYPE "public"."audit_log_action" AS ENUM('auto_applied', 'queued_for_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."balance_assertion_source" AS ENUM('bank-feed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."jev_confidence_band" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."review_queue_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."transaction_created_by" AS ENUM('user', 'ai', 'connector');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('manual', 'import', 'receipt-match');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'cleared', 'reconciled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "account_type" NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"currency" text NOT NULL,
	"external_ref" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"posting_id" uuid NOT NULL,
	"action" "audit_log_action" NOT NULL,
	"category_id" uuid,
	"source" text NOT NULL,
	"confidence" numeric(4, 3),
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_assertions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"asserted_amount" numeric(20, 8) NOT NULL,
	"source" "balance_assertion_source" NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
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
CREATE TABLE "postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"currency" text NOT NULL,
	"counterparty_raw" text,
	"counterparty_resolved" text,
	"category_id" uuid,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"posting_id" uuid NOT NULL,
	"suggested_category_id" uuid,
	"confidence_band" "jev_confidence_band" NOT NULL,
	"source" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" "review_queue_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"source" "transaction_source" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"created_by" "transaction_created_by" NOT NULL,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_posting_id_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD CONSTRAINT "balance_assertions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_posting_id_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_suggested_category_id_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_tenant_idx" ON "accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "accounts_path_idx" ON "accounts" USING btree ("path");--> statement-breakpoint
CREATE INDEX "audit_log_posting_idx" ON "audit_log" USING btree ("posting_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "balance_assertions_account_date_idx" ON "balance_assertions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "categories_tenant_idx" ON "categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "categories_primary_idx" ON "categories" USING btree ("primary");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_system_detailed_unique_idx" ON "categories" USING btree ("detailed") WHERE "categories"."tenant_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_detailed_unique_idx" ON "categories" USING btree ("tenant_id","detailed") WHERE "categories"."tenant_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "categorization_rules_tenant_idx" ON "categorization_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_pattern_idx" ON "categorization_rules" USING btree ("pattern");--> statement-breakpoint
CREATE INDEX "postings_transaction_idx" ON "postings" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "postings_account_idx" ON "postings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "review_queue_status_idx" ON "review_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_queue_posting_idx" ON "review_queue" USING btree ("posting_id");--> statement-breakpoint
CREATE INDEX "transactions_tenant_date_idx" ON "transactions" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_ref_unique_idx" ON "transactions" USING btree ("external_ref") WHERE "transactions"."external_ref" IS NOT NULL;