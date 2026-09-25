CREATE TYPE "public"."connector_provider" AS ENUM('plaid', 'enable-banking');--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"tenant_id" uuid NOT NULL,
	"provider" "connector_provider" NOT NULL,
	"fields_ciphertext" text NOT NULL,
	"fields_nonce" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_credentials_tenant_id_provider_pk" PRIMARY KEY("tenant_id","provider")
);
