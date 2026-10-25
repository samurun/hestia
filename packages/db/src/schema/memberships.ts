import { sql } from "drizzle-orm"
import {
  index,
  pgEnum,
  pgPolicy,
  pgTable,
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
import { users } from "./auth"
import { organizations } from "./organizations"

export const memberRole = pgEnum("member_role", ["owner", "manager", "staff"])

export type MemberRole = (typeof memberRole.enumValues)[number]

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole().notNull(),
    ...timestamps,
  },
  (t) => [
    unique().on(t.orgId, t.userId),
    // Target for composite FKs that pin child rows to the same org.
    unique().on(t.id, t.orgId),
    index().on(t.userId),
    pgPolicy("org_isolation", {
      for: "select",
      to: appRole,
      using: sql`org_id = ${currentOrgId}`,
    }),
    // A user can see their own memberships across orgs, outside an org
    // context only (see member_read on organizations).
    pgPolicy("own_memberships", {
      for: "select",
      to: appRole,
      using: sql`${currentOrgId} is null and user_id = ${currentUserId}`,
    }),
    // Only owners manage members. The one exception bootstraps a new org:
    // its creator may add themselves as owner while it has no members.
    // app_* functions are defined in migrations/0002_memberships.sql.
    pgPolicy("owner_insert", {
      for: "insert",
      to: appRole,
      withCheck: sql`org_id = ${currentOrgId} and (
        app_is_org_owner(org_id, ${currentUserId})
        or (user_id = ${currentUserId} and role = 'owner' and not app_org_has_members(org_id))
      )`,
    }),
    pgPolicy("owner_update", {
      for: "update",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and app_is_org_owner(org_id, ${currentUserId})`,
      withCheck: sql`org_id = ${currentOrgId} and app_is_org_owner(org_id, ${currentUserId})`,
    }),
    pgPolicy("owner_delete", {
      for: "delete",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and app_is_org_owner(org_id, ${currentUserId})`,
    }),
  ]
)
