ALTER TYPE "public"."ai_provider" ADD VALUE 'typesafe' BEFORE 'opencode';--> statement-breakpoint
ALTER TABLE "ai_settings" DROP CONSTRAINT "ai_settings_role_provider";--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_role_provider" CHECK (("ai_settings"."role" = 'categorization' AND "ai_settings"."provider"::text IN ('typesafe', 'opencode', 'openrouter', 'jev-custom'))
        OR ("ai_settings"."role" = 'chat' AND "ai_settings"."provider"::text IN ('opencode', 'openrouter', 'openai', 'anthropic', 'gemini', 'openai-compatible')));