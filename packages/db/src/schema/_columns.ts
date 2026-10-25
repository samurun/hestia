import { sql } from "drizzle-orm"
import { pgPolicy, pgRole, timestamp, uuid } from "drizzle-orm/pg-core"

/** Runtime role the API connects as; created in docker/postgres/init.sql. */
export const appRole = pgRole("hestia_app").existing()

/**
 * The org set by `withOrg()` for the current transaction, or NULL.
 * `nullif` matters: after a transaction-local set_config ends, the setting
 * reverts to '' rather than NULL, and ''::uuid would raise.
 */
export const currentOrgId = sql`nullif(current_setting('app.org_id', true), '')::uuid`

export const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`)

export const createdAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow()

export const timestamps = {
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/** Restricts every row of a table to the current org. `column` is the SQL name. */
export const orgIsolation = (column = "org_id") =>
  pgPolicy("org_isolation", {
    as: "permissive",
    for: "all",
    to: appRole,
    using: sql`${sql.raw(column)} = ${currentOrgId}`,
    withCheck: sql`${sql.raw(column)} = ${currentOrgId}`,
  })
