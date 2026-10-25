import { sql } from "drizzle-orm"
import {
  check,
  pgPolicy,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import {
  appRole,
  currentOrgId,
  currentUserId,
  id,
  timestamps,
} from "./_columns"
import { organizations } from "./organizations"

// Skeleton for RBAC scoping (#4); the rest of the columns and CRUD land in #8.
// app_* functions and the creator-assignment trigger are defined in
// migrations/0004_rbac.sql.

const canManageAny = sql`app_member_role(org_id, ${currentUserId}) in ('owner', 'manager')`
const canRead = sql`app_can_read_property(org_id, id, ${currentUserId})`
const canManage = sql`app_can_manage_property(org_id, id, ${currentUserId})`

export const properties = pgTable(
  "properties",
  {
    id: id(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [
    unique().on(t.id, t.orgId),
    check(
      "properties_name_check",
      sql`char_length(${t.name}) between 1 and 200 and ${t.name} = btrim(${t.name})`
    ),
    // Owners see every property; managers and staff only assigned ones.
    // A manager who creates a property is assigned to it by a trigger.
    pgPolicy("property_read", {
      for: "select",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and ${canRead}`,
    }),
    pgPolicy("property_insert", {
      for: "insert",
      to: appRole,
      withCheck: sql`org_id = ${currentOrgId} and ${canManageAny}`,
    }),
    pgPolicy("property_update", {
      for: "update",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and ${canManage}`,
      withCheck: sql`org_id = ${currentOrgId} and ${canManage}`,
    }),
    pgPolicy("property_delete", {
      for: "delete",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and ${canManage}`,
    }),
  ]
)
