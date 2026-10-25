import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_MIGRATE_URL
if (!url) throw new Error("DATABASE_MIGRATE_URL is not set")

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: { url },
})
