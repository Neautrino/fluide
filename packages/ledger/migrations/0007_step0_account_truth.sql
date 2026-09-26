CREATE TYPE "public"."connector_kind" AS ENUM('bank', 'gst-gsp', 'aa-fiu', 'tax-portal-upload', 'manual');--> statement-breakpoint
CREATE TYPE "public"."connector_status" AS ENUM('active', 'reauth_required', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."account_kind" AS ENUM('cash', 'investment', 'property', 'vehicle', 'crypto', 'credit', 'loan', 'other');--> statement-breakpoint
CREATE TYPE "public"."balance_type" AS ENUM('current', 'available', 'limit');--> statement-breakpoint
CREATE TYPE "public"."transaction_void_reason" AS ENUM('pending_posted', 'provider_modified', 'provider_removed', 'duplicate');--> statement-breakpoint
DROP INDEX "balance_assertions_account_date_idx";--> statement-breakpoint
DROP INDEX "transactions_external_ref_unique_idx";--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "credential_ciphertext" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "credential_nonce" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "kind" "connector_kind" DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "status" "connector_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "kind" "account_kind";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "connector_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "official_name" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "mask" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "provider_type" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "provider_subtype" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "exclude_from_net_worth" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD COLUMN "balance_type" "balance_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD COLUMN "currency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reverses_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "void_reason" "transaction_void_reason";--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reverses_transaction_id_transactions_id_fk" FOREIGN KEY ("reverses_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_connector_idx" ON "accounts" USING btree ("connector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_tenant_external_ref_unique_idx" ON "accounts" USING btree ("tenant_id","external_ref") WHERE "accounts"."external_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "balance_assertions_account_type_date_idx" ON "balance_assertions" USING btree ("account_id","balance_type","date");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_reverses_unique_idx" ON "transactions" USING btree ("reverses_transaction_id") WHERE "transactions"."reverses_transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_ref_unique_idx" ON "transactions" USING btree ("external_ref") WHERE "transactions"."external_ref" IS NOT NULL AND "transactions"."voided_at" IS NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_credential_unless_disconnected" CHECK ("connectors"."status" = 'disconnected'
        OR ("connectors"."credential_ciphertext" IS NOT NULL AND "connectors"."credential_nonce" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_kind_matches_type" CHECK ("accounts"."kind" IS NULL
        OR ("accounts"."kind" IN ('cash', 'investment', 'property', 'vehicle', 'crypto') AND "accounts"."type" = 'asset')
        OR ("accounts"."kind" IN ('credit', 'loan') AND "accounts"."type" = 'liability')
        OR ("accounts"."kind" = 'other' AND "accounts"."type" IN ('asset', 'liability')));--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD CONSTRAINT "balance_assertions_limit_non_negative" CHECK ("balance_assertions"."balance_type" <> 'limit' OR "balance_assertions"."asserted_amount" >= 0);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_void_reason_iff_voided" CHECK (("transactions"."voided_at" IS NULL) = ("transactions"."void_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_not_self_reversing" CHECK ("transactions"."reverses_transaction_id" <> "transactions"."id");