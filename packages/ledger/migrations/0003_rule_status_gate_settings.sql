CREATE TYPE "public"."categorization_rule_status" AS ENUM('proposed', 'active', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."audit_log_action" ADD VALUE 'recategorized';--> statement-breakpoint
CREATE TABLE "gate_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"high_confidence" numeric(4, 3) DEFAULT '0.750' NOT NULL,
	"low_confidence" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"min_vendor_occurrences" integer DEFAULT 3 NOT NULL,
	"amount_range_tolerance" numeric(6, 3) DEFAULT '0.500' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gate_settings_confidence_bands" CHECK (0 <= "gate_settings"."low_confidence" AND "gate_settings"."low_confidence" < "gate_settings"."high_confidence" AND "gate_settings"."high_confidence" <= 1),
	CONSTRAINT "gate_settings_min_vendor_occurrences" CHECK ("gate_settings"."min_vendor_occurrences" >= 1),
	CONSTRAINT "gate_settings_amount_range_tolerance" CHECK ("gate_settings"."amount_range_tolerance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "tx_id" bigint DEFAULT txid_current() NOT NULL;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD COLUMN "status" "categorization_rule_status" DEFAULT 'active' NOT NULL;