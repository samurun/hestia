import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { sql } from "@workspace/db"
import { Elysia } from "elysia"

import { db } from "./db"
import { env } from "./env"

export const app = new Elysia()
  .use(cors({ origin: env.WEB_ORIGIN }))
  .use(
    openapi({
      path: "/swagger",
      provider: "swagger-ui",
      documentation: {
        info: { title: "Hestia API", version: "0.0.1" },
      },
    })
  )
  .get(
    "/health",
    async ({ status }) => {
      try {
        await db.execute(sql`select 1`)
        return { status: "ok", db: "up" } as const
      } catch {
        return status(503, { status: "error", db: "down" } as const)
      }
    },
    { detail: { tags: ["System"], summary: "Health check" } }
  )
  .listen(env.API_PORT)

export type App = typeof app

console.log(`API listening on http://localhost:${env.API_PORT}`)
