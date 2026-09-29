CREATE TYPE "public"."transfer_kind" AS ENUM('transfer', 'card_payment', 'loan_payment', 'investment');--> statement-breakpoint
CREATE TYPE "public"."transfer_mark_method" AS ENUM('pair_match', 'provider_tag');--> statement-breakpoint
CREATE TABLE "transfer_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"pair_transaction_id" uuid,
	"kind" "transfer_kind" NOT NULL,
	"method" "transfer_mark_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_marks_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
ALTER TABLE "transfer_marks" ADD CONSTRAINT "transfer_marks_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_marks" ADD CONSTRAINT "transfer_marks_pair_transaction_id_transactions_id_fk" FOREIGN KEY ("pair_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transfer_marks_tenant_idx" ON "transfer_marks" USING btree ("tenant_id");