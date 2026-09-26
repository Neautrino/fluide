ALTER TYPE "public"."transaction_source" ADD VALUE 'opening-balance';--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD COLUMN "provider_balance_type" text;--> statement-breakpoint
ALTER TABLE "balance_assertions" ADD COLUMN "is_fallback" boolean DEFAULT false NOT NULL;