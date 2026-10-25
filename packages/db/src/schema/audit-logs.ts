import { sql } from "drizzle-orm"
import {
  index,
  inet,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import { appRole, createdAt, currentOrgId, id } from "./_columns"
import { users } from "./auth"
import { organizations } from "./organizations"

/**
 * Append-only: the app role may insert and read, never update or delete.
 * Triggers in migrations/0005_audit_append_only.sql enforce this for every
 * role and keep ids in commit order for paging; they also overwrite `id`
 * and `createdAt` on insert.
 * `action` is "<entity>.<verb>", e.g. "organization.create".
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    // Null for system actions, or when the user was deleted.
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: uuid(),
    before: jsonb(),
    after: jsonb(),
    ip: inet(),
    createdAt: createdAt(),
  },
  (t) => [
    // ids are uuidv7, so (org_id, id) also orders by time for paging.
    index().on(t.orgId, t.id),
    index().on(t.orgId, t.entityId),
    pgPolicy("org_isolation", {
      for: "select",
      to: appRole,
      using: sql`org_id = ${currentOrgId}`,
    }),
    pgPolicy("audit_insert", {
      for: "insert",
      to: appRole,
      withCheck: sql`org_id = ${currentOrgId}`,
    }),
  ]
)
