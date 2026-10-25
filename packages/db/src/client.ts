import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

export function createDb(url: string) {
  const client = postgres(url)
  return drizzle({ client, schema, casing: "snake_case" })
}

export type Db = ReturnType<typeof createDb>
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

export type DbContext = { orgId?: string; userId?: string }

/**
 * Runs `fn` in a transaction with the RLS context set. Policies read
 * `app.org_id` (tenant rows) and `app.user_id` (the user's own memberships),
 * so queries outside this helper see no tenant rows.
 */
export function withContext<T>(
  db: Db,
  { orgId = "", userId = "" }: DbContext,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${orgId}, true), set_config('app.user_id', ${userId}, true)`
    )
    return fn(tx)
  })
}

/** Runs `fn` scoped to one org. */
export function withOrg<T>(
  db: Db,
  orgId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return withContext(db, { orgId }, fn)
}
