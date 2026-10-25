CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"tax_id" varchar(13),
	"branch_code" varchar(5) DEFAULT '00000' NOT NULL,
	"is_vat_registered" boolean DEFAULT false NOT NULL,
	"address" text,
	"promptpay_id" varchar(15),
	"settings" jsonb DEFAULT '{"graceDays":0,"lateFeePerDay":0,"lateFeeCap":null,"bookingExpiryDays":7,"bookingForfeitOnCancel":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_created_at_index" ON "audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE POLICY "org_isolation" ON "organizations" AS PERMISSIVE FOR ALL TO "hestia_app" USING (id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "org_isolation" ON "audit_logs" AS PERMISSIVE FOR ALL TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);