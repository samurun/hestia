import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { sql } from "@workspace/db"
import { Elysia, t } from "elysia"

import { db } from "./db"
import { env } from "./env"

export const app = new Elysia()
  .use(cors({ origin: env.WEB_ORIGIN }))
  .use(
    openapi({
      path: "/swagger",
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
    {
      response: {
        200: t.Object({ status: t.Literal("ok"), db: t.Literal("up") }),
        503: t.Object({ status: t.Literal("error"), db: t.Literal("down") }),
      },
      detail: { tags: ["System"], summary: "Health check" },
    }
  )
  .listen(env.API_PORT)

export type App = typeof app

console.log(`API listening on http://localhost:${env.API_PORT}`)
