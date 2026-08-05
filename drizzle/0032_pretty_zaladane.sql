CREATE TABLE "interaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"deal_id" uuid,
	"created_by" text,
	"type" text NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject" text,
	"body_enc" text,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"next_step" text,
	"next_step_at" date,
	"source" text DEFAULT 'manual' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_type_check" CHECK ("interaction"."type" in ('meeting','visit','call','email','note')),
	CONSTRAINT "interaction_direction_check" CHECK ("interaction"."direction" in ('inbound','outbound','internal')),
	CONSTRAINT "interaction_source_check" CHECK ("interaction"."source" in ('manual','email','import'))
);
--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "interaction_id" uuid;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interaction_org_idx" ON "interaction" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "interaction_company_idx" ON "interaction" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "interaction_org_company_idx" ON "interaction" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "interaction_occurred_idx" ON "interaction" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "interaction_contact_idx" ON "interaction" USING btree ("contact_id");--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_interaction_id_interaction_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_interaction_idx" ON "todo" USING btree ("interaction_id");