import { beforeAll } from "bun:test"

import { resetTestDatabase } from "@workspace/db/testing"

import "./env"

beforeAll(async () => {
  await resetTestDatabase(process.env.TEST_DATABASE_MIGRATE_URL!)
})
