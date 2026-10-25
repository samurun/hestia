CREATE TYPE "public"."member_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_orgId_userId_unique" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_org_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_user_id_index" ON "memberships" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_org_id_organizations_id_fk" FOREIGN KEY ("active_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "member_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (id in (select org_id from memberships where user_id = nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "org_isolation" ON "memberships" AS PERMISSIVE FOR ALL TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "own_memberships" ON "memberships" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);