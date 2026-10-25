import { boolean, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core"

import { id, orgIsolation, timestamps } from "./_columns"

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
  () => [orgIsolation("id")]
)
