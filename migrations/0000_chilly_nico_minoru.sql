CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"mis" text NOT NULL,
	"previous_amount" numeric NOT NULL,
	"new_amount" numeric NOT NULL,
	"change_type" text NOT NULL,
	"change_reason" text,
	"document_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget_na853_split" (
	"id" serial PRIMARY KEY NOT NULL,
	"mis" text NOT NULL,
	"na853" text NOT NULL,
	"user_view" numeric DEFAULT '0',
	"proip" numeric DEFAULT '0',
	"ethsia_pistosi" numeric DEFAULT '0',
	"katanomes_etous" numeric DEFAULT '0',
	"q1" numeric DEFAULT '0',
	"q2" numeric DEFAULT '0',
	"q3" numeric DEFAULT '0',
	"q4" numeric DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"mis" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"current_budget" numeric NOT NULL,
	"ethsia_pistosi" numeric NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"recipients" jsonb NOT NULL,
	"protocol_date" timestamp,
	"total_amount" numeric NOT NULL,
	"document_date" timestamp,
	"original_protocol_date" timestamp,
	"is_correction" boolean DEFAULT false,
	"original_document_id" integer,
	"project_na853" text,
	"unit" text NOT NULL,
	"generated_by" integer,
	"original_protocol_number" text,
	"comments" text,
	"updated_by" integer,
	"department" text,
	"status" text DEFAULT 'draft',
	"protocol_number_input" text,
	"expenditure_type" text NOT NULL,
	"project_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"mis" text NOT NULL,
	"na853" text,
	"event_description" text,
	"implementing_agency" text[],
	"region" text,
	"municipality" text,
	"budget_na853" numeric DEFAULT '0',
	"budget_e069" numeric DEFAULT '0',
	"budget_na271" numeric DEFAULT '0',
	"ethsia_pistosi" numeric DEFAULT '0',
	"status" text DEFAULT 'pending',
	"event_type" text,
	"event_year" text[],
	"procedures" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "project_catalog_mis_unique" UNIQUE("mis")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"unit" text,
	"active" boolean DEFAULT true,
	"name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "budget_history" ADD CONSTRAINT "budget_history_document_id_generated_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."generated_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_history" ADD CONSTRAINT "budget_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_notifications" ADD CONSTRAINT "budget_notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;