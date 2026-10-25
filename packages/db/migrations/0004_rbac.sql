CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_id_orgId_unique" UNIQUE("id","org_id"),
	CONSTRAINT "properties_name_check" CHECK (char_length("properties"."name") between 1 and 200 and "properties"."name" = btrim("properties"."name"))
);
--> statement-breakpoint
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_properties" (
	"org_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_properties_membership_id_property_id_pk" PRIMARY KEY("membership_id","property_id")
);
--> statement-breakpoint
ALTER TABLE "membership_properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_id_orgId_unique" UNIQUE("id","org_id");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_properties" ADD CONSTRAINT "membership_properties_membership_id_org_id_memberships_id_org_id_fk" FOREIGN KEY ("membership_id","org_id") REFERENCES "public"."memberships"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_properties" ADD CONSTRAINT "membership_properties_property_id_org_id_properties_id_org_id_fk" FOREIGN KEY ("property_id","org_id") REFERENCES "public"."properties"("id","org_id") ON DELETE cascade ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE INDEX "membership_properties_property_id_index" ON "membership_properties" USING btree ("property_id");--> statement-breakpoint
-- Hand-written (drizzle-kit can't model functions or triggers): must stay
-- before the policies that call them. SECURITY DEFINER so policies read
-- memberships and assignments without going through their RLS.
CREATE FUNCTION app_member_role(p_org uuid, p_user uuid) RETURNS member_role
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM memberships WHERE org_id = p_org AND user_id = p_user
  $$;--> statement-breakpoint
-- Owners: every property. Managers/staff: assigned ones (role-aware, so rows
-- left from an earlier role never grant access). VOLATILE so INSERT ...
-- RETURNING sees the assignment the BEFORE INSERT trigger just made; a
-- STABLE function would use the statement's snapshot and miss it.
CREATE FUNCTION app_can_read_property(p_org uuid, p_property uuid, p_user uuid) RETURNS boolean
  LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
    SELECT app_is_org_owner(p_org, p_user) OR EXISTS (
      SELECT 1 FROM membership_properties mp
      JOIN memberships m ON m.id = mp.membership_id
      WHERE mp.property_id = p_property AND m.org_id = p_org
        AND m.user_id = p_user AND m.role IN ('manager', 'staff')
    )
  $$;--> statement-breakpoint
CREATE FUNCTION app_can_manage_property(p_org uuid, p_property uuid, p_user uuid) RETURNS boolean
  LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
    SELECT app_is_org_owner(p_org, p_user) OR EXISTS (
      SELECT 1 FROM membership_properties mp
      JOIN memberships m ON m.id = mp.membership_id
      WHERE mp.property_id = p_property AND m.org_id = p_org
        AND m.user_id = p_user AND m.role = 'manager'
    )
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_member_role(uuid, uuid), app_can_read_property(uuid, uuid, uuid), app_can_manage_property(uuid, uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_member_role(uuid, uuid), app_can_read_property(uuid, uuid, uuid), app_can_manage_property(uuid, uuid, uuid) TO hestia_app;--> statement-breakpoint

-- A manager who creates a property looks after it. BEFORE INSERT (with the
-- deferred FK above) so the assignment exists when RETURNING is checked.
CREATE FUNCTION app_assign_property_creator() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      INSERT INTO membership_properties (org_id, membership_id, property_id)
        SELECT NEW.org_id, m.id, NEW.id FROM memberships m
        WHERE m.org_id = NEW.org_id AND m.role = 'manager'
          AND m.user_id = nullif(current_setting('app.user_id', true), '')::uuid;
      RETURN NEW;
    END
  $$;--> statement-breakpoint
CREATE TRIGGER properties_assign_creator
  BEFORE INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION app_assign_property_creator();--> statement-breakpoint

-- Owners see everything, so assignments are meaningless for them; clear them
-- on promotion so they can't silently come back after a later demotion.
CREATE FUNCTION app_clear_owner_assignments() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      DELETE FROM membership_properties WHERE membership_id = NEW.id;
      RETURN NEW;
    END
  $$;--> statement-breakpoint
CREATE TRIGGER memberships_clear_owner_assignments
  AFTER UPDATE OF role ON memberships
  FOR EACH ROW WHEN (NEW.role = 'owner' AND OLD.role <> 'owner')
  EXECUTE FUNCTION app_clear_owner_assignments();--> statement-breakpoint

-- orgTx now also re-checks the role: return it, and lock FOR SHARE so a
-- concurrent role change (not just a delete) waits for the transaction.
DROP FUNCTION app_lock_membership(uuid, uuid);--> statement-breakpoint
CREATE FUNCTION app_lock_membership(p_org uuid, p_user uuid) RETURNS member_role
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      r member_role;
    BEGIN
      SELECT role INTO r FROM memberships
        WHERE org_id = p_org AND user_id = p_user
        FOR SHARE;
      RETURN r;
    END
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_lock_membership(uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_lock_membership(uuid, uuid) TO hestia_app;--> statement-breakpoint
CREATE POLICY "property_read" ON "properties" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_can_read_property(org_id, id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "property_insert" ON "properties" AS PERMISSIVE FOR INSERT TO "hestia_app" WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_member_role(org_id, nullif(current_setting('app.user_id', true), '')::uuid) in ('owner', 'manager'));--> statement-breakpoint
CREATE POLICY "property_update" ON "properties" AS PERMISSIVE FOR UPDATE TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_can_manage_property(org_id, id, nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_can_manage_property(org_id, id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "property_delete" ON "properties" AS PERMISSIVE FOR DELETE TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_can_manage_property(org_id, id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "assignment_read" ON "membership_properties" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and (app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid) or membership_id in (select id from memberships where user_id = nullif(current_setting('app.user_id', true), '')::uuid)));--> statement-breakpoint
CREATE POLICY "owner_insert" ON "membership_properties" AS PERMISSIVE FOR INSERT TO "hestia_app" WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "owner_delete" ON "membership_properties" AS PERMISSIVE FOR DELETE TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));