import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core"

import {
  appRole,
  currentUserId,
  id,
  orgIsolation,
  timestamps,
} from "./_columns"

/** Money values are in satang. */
export type OrgSettings = {
  graceDays: number
  lateFeePerDay: number
  lateFeeCap: number | null
  bookingExpiryDays: number
  bookingForfeitOnCancel: boolean
}

export const defaultOrgSettings: OrgSettings = {
  graceDays: 0,
  lateFeePerDay: 0,
  lateFeeCap: null,
  bookingExpiryDays: 7,
  bookingForfeitOnCancel: true,
}

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text().notNull(),
    taxId: varchar({ length: 13 }),
    branchCode: varchar({ length: 5 }).notNull().default("00000"),
    isVatRegistered: boolean().notNull().default(false),
    address: text(),
    promptpayId: varchar({ length: 15 }),
    settings: jsonb()
      .$type<OrgSettings>()
      .notNull()
      .default(defaultOrgSettings),
    ...timestamps,
  },
  (t) => [
    check(
      "organizations_name_check",
      sql`char_length(${t.name}) between 1 and 200 and ${t.name} = btrim(${t.name})`
    ),
    orgIsolation("id"),
    // Lets a user list every org they belong to, before picking one.
    pgPolicy("member_read", {
      for: "select",
      to: appRole,
      using: sql`id in (select org_id from memberships where user_id = ${currentUserId})`,
    }),
  ]
)
