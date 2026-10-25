DROP INDEX "audit_logs_org_id_created_at_index";--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_id_index" ON "audit_logs" USING btree ("org_id","id");--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_entity_id_index" ON "audit_logs" USING btree ("org_id","entity_id");--> statement-breakpoint
DROP POLICY "org_isolation" ON "audit_logs" CASCADE;--> statement-breakpoint
CREATE POLICY "audit_insert" ON "audit_logs" AS PERMISSIVE FOR INSERT TO "hestia_app" WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "org_isolation" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "hestia_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
-- Hand-written (drizzle-kit can't model triggers or grants) -----------------

-- Append-only for every role, not just through grants: a later GRANT ALL or
-- a recreated table must not quietly allow rewriting history. The one
-- allowed UPDATE is the FK's ON DELETE SET NULL when a user is deleted.
-- Maintenance (e.g. test resets) can bypass triggers with
-- session_replication_role = replica, which needs superuser.
CREATE FUNCTION app_audit_logs_append_only() RETURNS trigger
  LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL AND OLD.actor_id IS NOT NULL
        AND ROW(NEW.id, NEW.org_id, NEW.action, NEW.entity, NEW.entity_id,
                NEW.before, NEW.after, NEW.ip, NEW.created_at)
          IS NOT DISTINCT FROM
            ROW(OLD.id, OLD.org_id, OLD.action, OLD.entity, OLD.entity_id,
                OLD.before, OLD.after, OLD.ip, OLD.created_at)
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'audit_logs is append-only (% rejected)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
    END
  $$;--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION app_audit_logs_append_only();--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION app_audit_logs_append_only();--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_logs" FROM hestia_app;--> statement-breakpoint

-- Ids are uuidv7 and the API pages by id, so rows must become visible in id
-- order. A row's id is set at INSERT but it only becomes visible at COMMIT,
-- so a slow transaction could commit an older id behind a reader's cursor.
-- Serialize audit writers per org until commit, and re-issue the id (and
-- timestamp) after taking the lock, so id order matches commit order.
CREATE FUNCTION app_audit_logs_order() RETURNS trigger
  LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended('audit_logs:' || NEW.org_id::text, 0));
      NEW.id := uuidv7();
      NEW.created_at := clock_timestamp();
      RETURN NEW;
    END
  $$;--> statement-breakpoint
CREATE TRIGGER audit_logs_order
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION app_audit_logs_order();
