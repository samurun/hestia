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

/**
 * Runs `fn` in a transaction scoped to one org. RLS policies read
 * `app.org_id`, so queries outside this helper see no tenant rows.
 */
export function withOrg<T>(
  db: Db,
  orgId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`)
    return fn(tx)
  })
}
