import { index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { createdAt, id, orgIsolation } from "./_columns"
import { users } from "./auth"
import { organizations } from "./organizations"

/** Append-only: rows are never updated or deleted. */
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
  (t) => [index().on(t.orgId, t.createdAt), orgIsolation()]
)
