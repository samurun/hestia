import { resetTestDatabase } from "@workspace/db/testing"

export default async function globalSetup() {
  await resetTestDatabase(
    process.env.TEST_DATABASE_MIGRATE_URL ??
      "postgres://hestia:hestia@localhost:5433/hestia_test"
  )
}
