CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "connector_provider" NOT NULL,
	"external_id" text,
	"institution_name" text,
	"credential_ciphertext" text NOT NULL,
	"credential_nonce" text NOT NULL,
	"cursor" text,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_tenant_provider_external_id_unique_idx" ON "connectors" USING btree ("tenant_id","provider","external_id") WHERE "connectors"."external_id" IS NOT NULL;