import { sql } from "drizzle-orm"
import {
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  uuid,
} from "drizzle-orm/pg-core"

import { appRole, createdAt, currentOrgId, currentUserId } from "./_columns"
import { memberships } from "./memberships"
import { properties } from "./properties"

const isOwner = sql`app_is_org_owner(org_id, ${currentUserId})`

/** Which properties a manager or staff member looks after. */
export const membershipProperties = pgTable(
  "membership_properties",
  {
    orgId: uuid().notNull(),
    membershipId: uuid().notNull(),
    propertyId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.membershipId, t.propertyId] }),
    index().on(t.propertyId),
    // Both FKs include org_id, so a membership can't be given another
    // org's property.
    foreignKey({
      columns: [t.membershipId, t.orgId],
      foreignColumns: [memberships.id, memberships.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.propertyId, t.orgId],
      foreignColumns: [properties.id, properties.orgId],
    }).onDelete("cascade"),
    // Owners see every assignment; others only their own.
    pgPolicy("assignment_read", {
      for: "select",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and (${isOwner} or membership_id in (select id from memberships where user_id = ${currentUserId}))`,
    }),
    // Assignments are part of member management, which is owner-only.
    pgPolicy("owner_insert", {
      for: "insert",
      to: appRole,
      withCheck: sql`org_id = ${currentOrgId} and ${isOwner}`,
    }),
    pgPolicy("owner_delete", {
      for: "delete",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and ${isOwner}`,
    }),
  ]
)
