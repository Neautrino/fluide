CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'income', 'expense', 'equity');--> statement-breakpoint
CREATE TYPE "public"."balance_assertion_source" AS ENUM('bank-feed', 'manual');--> statement-breakpoint
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
CREATE TABLE "balance_assertions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"asserted_amount" numeric(20, 8) NOT NULL,
	"source" "balance_assertion_source" NOT NULL,
	"verified_at" timestamp with time zone
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
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"source" "transaction_source" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"created_by" "transaction_created_by" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD CONSTRAINT "balance_assertions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_tenant_idx" ON "accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "accounts_path_idx" ON "accounts" USING btree ("path");--> statement-breakpoint
CREATE INDEX "balance_assertions_account_date_idx" ON "balance_assertions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "postings_transaction_idx" ON "postings" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "postings_account_idx" ON "postings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_tenant_date_idx" ON "transactions" USING btree ("tenant_id","date");