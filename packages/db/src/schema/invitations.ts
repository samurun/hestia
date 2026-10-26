import { sql } from "drizzle-orm"
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { appRole, createdAt, currentOrgId, currentUserId, id } from "./_columns"
import { users } from "./auth"
import { memberRole } from "./memberships"
import { organizations } from "./organizations"

const isOwner = sql`app_is_org_owner(org_id, ${currentUserId})`

/**
 * Invites are owner-managed. Only the SHA-256 of the token is stored, so a
 * leaked table can't be turned into working links. Accepting goes through
 * app_accept_invitation() (migrations/0006_invitations.sql), because the
 * invitee isn't a member yet and RLS would hide the row.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Lowercased; the invitee must sign in with this address. */
    email: text().notNull(),
    role: memberRole().notNull(),
    /** Assigned on acceptance (ignored for owners). */
    propertyIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    tokenHash: text().notNull().unique(),
    invitedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // At most one open invite per address and org.
    uniqueIndex("invitations_open_email_index")
      .on(t.orgId, t.email)
      .where(sql`accepted_at is null and revoked_at is null`),
    check("invitations_email_lowercase", sql`${t.email} = lower(${t.email})`),
    pgPolicy("owner_read", {
      for: "select",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and ${isOwner}`,
    }),
    pgPolicy("owner_insert", {
      for: "insert",
      to: appRole,
      withCheck: sql`org_id = ${currentOrgId} and ${isOwner}`,
    }),
    pgPolicy("owner_update", {
      for: "update",
      to: appRole,
      using: sql`org_id = ${currentOrgId} and ${isOwner}`,
      withCheck: sql`org_id = ${currentOrgId} and ${isOwner}`,
    }),
  ]
)
