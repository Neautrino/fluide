ALTER TABLE "connectors" ADD COLUMN "replaced_by_connector_id" uuid;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "counted_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_replaced_by_connector_id_connectors_id_fk" FOREIGN KEY ("replaced_by_connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connectors_replaced_by_idx" ON "connectors" USING btree ("replaced_by_connector_id");