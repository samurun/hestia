import { fileURLToPath } from "node:url"

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url)
)

/**
 * Creates the database in `ownerUrl` if missing, grants the app role the same
 * privileges as docker/postgres/init.sql, applies migrations and empties every
 * table. Run as the schema owner, never against the dev database.
 */
export async function resetTestDatabase(ownerUrl: string) {
  const url = new URL(ownerUrl)
  const name = url.pathname.slice(1)
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset non-test database "${name}"`)
  }

  const admin = postgres({ ...pgOptions(url), database: "postgres", max: 1 })
  const [exists] =
    await admin`select 1 from pg_database where datname = ${name}`
  if (!exists) await admin.unsafe(`create database "${name}"`)
  await admin.end()

  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} })
  await sql.unsafe(`
    grant connect on database "${name}" to hestia_app;
    grant usage on schema public to hestia_app;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to hestia_app;
    alter default privileges in schema public
      grant usage, select on sequences to hestia_app;
  `)
  await migrate(drizzle({ client: sql }), { migrationsFolder })

  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'`
  if (tables.length > 0) {
    await sql.unsafe(
      `truncate ${tables.map((t) => `"${t.tablename}"`).join(", ")} cascade`
    )
  }
  await sql.end()
}

function pgOptions(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  }
}
