CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"insight_text" text NOT NULL,
	"ai_context_suggestions" text,
	"note_id" integer,
	"box_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_id" integer,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"ai_context_suggestions" text,
	"box_id" integer,
	"main_argument" text,
	"quotes" text,
	"concepts" text,
	"critical_notes" text,
	"connections" text,
	"research_notes" text,
	"memory_anchors" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdf_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_id" integer,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"box_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"authors" varchar(255),
	"year" integer,
	"doi" varchar(100),
	"pdf_url" text NOT NULL,
	"abstract" text,
	"status" varchar(50) DEFAULT 'okunacak',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_description" text NOT NULL,
	"status" varchar(50) DEFAULT 'todo',
	"due_date" date,
	"reference_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thesis_boxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"thesis_core_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thesis_core" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"research_question" text NOT NULL,
	"argument" text NOT NULL,
	"methodology" text NOT NULL,
	"academic_recommendations" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_box_id_thesis_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."thesis_boxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_reference_id_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_box_id_thesis_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."thesis_boxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_chunks" ADD CONSTRAINT "pdf_chunks_reference_id_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_chunks" ADD CONSTRAINT "pdf_chunks_box_id_thesis_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."thesis_boxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reference_id_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis_boxes" ADD CONSTRAINT "thesis_boxes_thesis_core_id_thesis_core_id_fk" FOREIGN KEY ("thesis_core_id") REFERENCES "public"."thesis_core"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_embedding_hnsw_index" ON "notes" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "pdf_chunks_embedding_hnsw_index" ON "pdf_chunks" USING hnsw ("embedding" vector_cosine_ops);