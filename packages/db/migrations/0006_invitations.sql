CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"property_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_email_lowercase" CHECK ("invitations"."email" = lower("invitations"."email"))
);
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_open_email_index" ON "invitations" USING btree ("org_id","email") WHERE accepted_at is null and revoked_at is null;--> statement-breakpoint
-- Hand-written (drizzle-kit can't model functions or triggers) -----------

-- Public, by token: what the invite page shows before sign-in. Returns raw
-- timestamps; the status is worked out once, in @workspace/shared.
CREATE FUNCTION app_invitation_preview(p_token_hash text)
  RETURNS TABLE (
    org_name text, email text, role member_role,
    expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz
  )
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT o.name, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at
    FROM invitations i JOIN organizations o ON o.id = i.org_id
    WHERE i.token_hash = p_token_hash
  $$;--> statement-breakpoint

-- Accepts an open invite for a signed-in user whose email matches, all in
-- one transaction: membership, property assignments, switching the session
-- to the org, and the audit row. SECURITY DEFINER: the invitee isn't a
-- member yet, so RLS would hide the invite and the org. Errors are raised
-- with stable messages the API maps to HTTP statuses.
CREATE FUNCTION app_accept_invitation(
  p_token_hash text, p_user uuid, p_session uuid, p_ip inet
) RETURNS uuid
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      inv invitations;
      user_email text;
      new_membership uuid;
      assigned uuid[] := '{}';
    BEGIN
      SELECT * INTO inv FROM invitations WHERE token_hash = p_token_hash FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
      IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_used'; END IF;
      IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_revoked'; END IF;
      IF inv.expires_at <= now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;

      SELECT lower(email) INTO user_email FROM users WHERE id = p_user;
      IF user_email IS DISTINCT FROM inv.email THEN
        RAISE EXCEPTION 'invitation_email_mismatch';
      END IF;
      IF EXISTS (SELECT 1 FROM memberships WHERE org_id = inv.org_id AND user_id = p_user) THEN
        RAISE EXCEPTION 'already_member';
      END IF;

      INSERT INTO memberships (org_id, user_id, role)
        VALUES (inv.org_id, p_user, inv.role)
        RETURNING id INTO new_membership;
      IF inv.role <> 'owner' THEN
        WITH added AS (
          INSERT INTO membership_properties (org_id, membership_id, property_id)
            SELECT inv.org_id, new_membership, p.id FROM properties p
            WHERE p.org_id = inv.org_id AND p.id = ANY (inv.property_ids)
            RETURNING property_id
        )
        SELECT coalesce(array_agg(property_id), '{}') INTO assigned FROM added;
      END IF;
      UPDATE invitations SET accepted_at = now(), accepted_by = p_user WHERE id = inv.id;

      UPDATE sessions SET active_org_id = inv.org_id WHERE id = p_session AND user_id = p_user;
      UPDATE users SET last_active_org_id = inv.org_id WHERE id = p_user;
      INSERT INTO audit_logs (org_id, actor_id, action, entity, entity_id, after, ip)
        VALUES (
          inv.org_id, p_user, 'invitation.accept', 'membership', new_membership,
          jsonb_build_object(
            'invitationId', inv.id, 'role', inv.role, 'propertyIds', to_jsonb(assigned)
          ),
          p_ip
        );
      RETURN inv.org_id;
    END
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_invitation_preview(text), app_accept_invitation(text, uuid, uuid, inet) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_invitation_preview(text), app_accept_invitation(text, uuid, uuid, inet) TO hestia_app;--> statement-breakpoint

-- Every org keeps at least one owner. Locking the org row serializes owner
-- changes, so two owners can't demote each other at the same time.
-- Deleting the org itself (cascade) is allowed. Deleting the account of an
-- org's only owner is deliberately blocked: ownership must be handed over
-- (or the org deleted) first, so no org is left without anyone in charge.
CREATE FUNCTION app_keep_an_owner() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner') THEN
        PERFORM 1 FROM organizations WHERE id = OLD.org_id FOR UPDATE;
        IF FOUND AND NOT EXISTS (
          SELECT 1 FROM memberships
          WHERE org_id = OLD.org_id AND role = 'owner' AND id <> OLD.id
        ) THEN
          RAISE EXCEPTION 'last_owner' USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END
  $$;--> statement-breakpoint
CREATE TRIGGER memberships_keep_an_owner
  BEFORE UPDATE OF role OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION app_keep_an_owner();--> statement-breakpoint
CREATE POLICY "owner_read" ON "invitations" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "owner_insert" ON "invitations" AS PERMISSIVE FOR INSERT TO "hestia_app" WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "owner_update" ON "invitations" AS PERMISSIVE FOR UPDATE TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid and app_is_org_owner(org_id, nullif(current_setting('app.user_id', true), '')::uuid));