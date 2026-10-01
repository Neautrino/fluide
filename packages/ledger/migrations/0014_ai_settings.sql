CREATE TYPE "public"."ai_provider" AS ENUM('opencode', 'openrouter', 'jev-custom', 'openai', 'anthropic', 'gemini', 'openai-compatible');--> statement-breakpoint
CREATE TYPE "public"."ai_role" AS ENUM('categorization', 'chat');--> statement-breakpoint
CREATE TABLE "ai_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"label" text NOT NULL,
	"key_ciphertext" text NOT NULL,
	"key_nonce" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credentials_tenant_id_provider_unique" UNIQUE("tenant_id","id","provider")
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"tenant_id" uuid NOT NULL,
	"role" "ai_role" NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"endpoint" text NOT NULL,
	"model" text NOT NULL,
	"credential_id" uuid,
	"last_test_ok" boolean,
	"last_test_at" timestamp with time zone,
	"last_test_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_tenant_id_role_pk" PRIMARY KEY("tenant_id","role"),
	CONSTRAINT "ai_settings_role_provider" CHECK (("ai_settings"."role" = 'categorization' AND "ai_settings"."provider" IN ('opencode', 'openrouter', 'jev-custom'))
        OR ("ai_settings"."role" = 'chat' AND "ai_settings"."provider" IN ('opencode', 'openrouter', 'openai', 'anthropic', 'gemini', 'openai-compatible'))),
	CONSTRAINT "ai_settings_key_unless_compatible" CHECK ("ai_settings"."credential_id" IS NOT NULL OR "ai_settings"."provider" = 'openai-compatible'),
	CONSTRAINT "ai_settings_endpoint_http" CHECK ("ai_settings"."endpoint" ~ '^https?://'),
	CONSTRAINT "ai_settings_model_present" CHECK (length(btrim("ai_settings"."model")) > 0)
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_credential_fk" FOREIGN KEY ("tenant_id","credential_id","provider") REFERENCES "public"."ai_credentials"("tenant_id","id","provider") ON DELETE no action ON UPDATE no action;