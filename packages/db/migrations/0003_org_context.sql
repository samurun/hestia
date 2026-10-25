ALTER POLICY "member_read" ON "organizations" TO hestia_app USING (nullif(current_setting('app.org_id', true), '')::uuid is null and id in (select org_id from memberships where user_id = nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
ALTER POLICY "own_memberships" ON "memberships" TO hestia_app USING (nullif(current_setting('app.org_id', true), '')::uuid is null and user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
-- Hand-written: orgTx calls this first so a member removed mid-request can't
-- keep acting. FOR KEY SHARE holds the row until the transaction ends, so a
-- concurrent DELETE waits. SECURITY DEFINER because locking a row needs the
-- owner-only UPDATE policy to pass.
CREATE FUNCTION app_lock_membership(p_org uuid, p_user uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      PERFORM 1 FROM memberships
        WHERE org_id = p_org AND user_id = p_user
        FOR KEY SHARE;
      RETURN FOUND;
    END
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_lock_membership(uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_lock_membership(uuid, uuid) TO hestia_app;
