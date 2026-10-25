import { index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { createdAt, id, orgIsolation } from "./_columns"
import { organizations } from "./organizations"

/** Append-only: rows are never updated or deleted. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    // FK to users is added once Better Auth owns the users table.
    actorId: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: uuid(),
    before: jsonb(),
    after: jsonb(),
    ip: inet(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.orgId, t.createdAt), orgIsolation()]
)
