CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"display_currency" text DEFAULT 'USD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_settings_display_currency_iso" CHECK ("tenant_settings"."display_currency" ~ '^[A-Z]{3}$')
);
