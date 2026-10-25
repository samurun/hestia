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
  currentUserId,
  id,
  orgIsolation,
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
    index().on(t.userId),
    orgIsolation(),
    // A user can always see their own memberships across orgs.
    pgPolicy("own_memberships", {
      for: "select",
      to: appRole,
      using: sql`user_id = ${currentUserId}`,
    }),
  ]
)
