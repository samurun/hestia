import { createDb } from "./client"
import { organizations } from "./schema"

const url = process.env.DATABASE_MIGRATE_URL
if (!url) throw new Error("DATABASE_MIGRATE_URL is not set")

const db = createDb(url)

const [org] = await db
  .insert(organizations)
  .values({ name: "หอพักตัวอย่าง" })
  .returning()

console.log(`Seeded organization ${org?.id}`)
await db.$client.end()
