-- SOURCE OF TRUTH: pgvector setup for the S1-3 embedding-similarity tier.
-- WHAT: enables the vector extension, adds postings.description_embedding
-- (384-dim, all-MiniLM-L6-v2), creates category_anchors for cold-start
-- matching, and HNSW cosine indexes on both embedding columns.
-- WHY: HNSW + vector_cosine_ops matches cosineDistance() from drizzle-orm's
-- sql/functions/vector -- the same distance metric app code queries with.
-- WHERE: table/column shape mirrors schema.ts; this migration also owns
-- the extension + index DDL that drizzle-kit generate cannot emit itself.

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "category_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"anchor_text" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "description_embedding" vector(384);
--> statement-breakpoint
ALTER TABLE "category_anchors" ADD CONSTRAINT "category_anchors_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "category_anchors_category_idx" ON "category_anchors" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "category_anchors_embedding_hnsw_idx" ON "category_anchors" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX "postings_description_embedding_hnsw_idx" ON "postings" USING hnsw ("description_embedding" vector_cosine_ops);
