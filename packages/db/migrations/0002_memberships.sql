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
ALTER TABLE "users" ADD COLUMN "last_active_org_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_user_id_index" ON "memberships" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_org_id_organizations_id_fk" FOREIGN KEY ("active_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_last_active_org_id_organizations_id_fk" FOREIGN KEY ("last_active_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_name_check" CHECK (char_length("organizations"."name") between 1 and 200 and "organizations"."name" = btrim("organizations"."name"));--> statement-breakpoint
-- Hand-written (drizzle-kit can't model functions or triggers): must stay
-- before the memberships policies, which call app_is_org_owner/app_org_has_members.
-- Helpers for memberships RLS. SECURITY DEFINER runs them as the table owner,
-- which RLS does not apply to, so policies on memberships can ask about
-- memberships without recursing into themselves.
CREATE FUNCTION app_is_org_owner(p_org uuid, p_user uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM memberships
      WHERE org_id = p_org AND user_id = p_user AND role = 'owner'
    )
  $$;--> statement-breakpoint
CREATE FUNCTION app_org_has_members(p_org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM memberships WHERE org_id = p_org)
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_is_org_owner(uuid, uuid), app_org_has_members(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_org_owner(uuid, uuid), app_org_has_members(uuid) TO hestia_app;--> statement-breakpoint

-- A removed member must not keep the org as their active or last-used org.
CREATE FUNCTION app_clear_active_org() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      UPDATE sessions SET active_org_id = NULL
        WHERE user_id = OLD.user_id AND active_org_id = OLD.org_id;
      UPDATE users SET last_active_org_id = NULL
        WHERE id = OLD.user_id AND last_active_org_id = OLD.org_id;
      RETURN OLD;
    END
  $$;--> statement-breakpoint
CREATE TRIGGER memberships_clear_active_org
  AFTER DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION app_clear_active_org();--> statement-breakpoint
CREATE POLICY "member_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (id in (select org_id from memberships where user_id = nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "org_isolation" ON "memberships" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "own_memberships" ON "memberships" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "owner_insert" ON "memberships" AS PERMISSIVE FOR INSERT TO "hestia_app" WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and (
        app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid)
        or (user_id = nullif(current_setting('app.user_id', true), '')::uuid and role = 'owner' and not app_org_has_members(org_id))
      ));--> statement-breakpoint
CREATE POLICY "owner_update" ON "memberships" AS PERMISSIVE FOR UPDATE TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "owner_delete" ON "memberships" AS PERMISSIVE FOR DELETE TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));