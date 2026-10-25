// Preloaded by every test run. Overrides (not defaults) because Bun has
// already loaded the dev .env, and tests must never touch the dev database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://hestia_app:hestia_app@localhost:5433/hestia_test"
process.env.TEST_DATABASE_MIGRATE_URL ??=
  "postgres://hestia:hestia@localhost:5433/hestia_test"
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret!!"
process.env.BETTER_AUTH_URL = "http://localhost:3001"
// The web e2e suite runs Next on its own port and points this at it.
process.env.WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? "http://localhost:3000"
