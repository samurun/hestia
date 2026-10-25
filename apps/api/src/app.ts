import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { sql } from "@workspace/db"
import { messageError, uuid } from "@workspace/shared/schemas"
import { Elysia } from "elysia"
import { z } from "zod"

import { auditRoutes } from "./audit-routes"
import { authOpenAPI } from "./auth"
import { db } from "./db"
import { env } from "./env"
import { findMembership } from "./memberships"
import { membershipRoutes } from "./memberships-routes"
import { OrgMembership } from "./org-model"
import { currentOrganizationRoutes, organizationRoutes } from "./organizations"
import { authPlugin } from "./plugins/auth"

const authDocs = await authOpenAPI()

export const app = new Elysia()
  .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
  .use(
    openapi({
      path: "/swagger",
      // Schemas are zod (@workspace/shared). Document the input side, i.e.
      // what callers send (a coerced query number is a string on the wire).
      mapJsonSchema: {
        zod: (schema: z.ZodType) =>
          z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
      },
      documentation: {
        info: { title: "Hestia API", version: "0.0.1" },
        components: authDocs.components as never,
        paths: authDocs.paths as never,
      },
    })
  )
  .use(authPlugin)
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
        200: z.object({ status: z.literal("ok"), db: z.literal("up") }),
        503: z.object({ status: z.literal("error"), db: z.literal("down") }),
      },
      detail: { tags: ["System"], summary: "Health check" },
    }
  )
  .get(
    "/me",
    async ({ user, session }) => ({
      user: { id: user.id, name: user.name, email: user.email },
      activeOrg: session.activeOrgId
        ? await findMembership(user.id, session.activeOrgId)
        : null,
    }),
    {
      auth: true,
      response: {
        200: z.object({
          user: z.object({ id: uuid, name: z.string(), email: z.email() }),
          activeOrg: OrgMembership.nullable(),
        }),
        401: messageError,
      },
      detail: { tags: ["Auth"], summary: "Current user and active org" },
    }
  )
  .use(organizationRoutes)
  .use(currentOrganizationRoutes)
  .use(membershipRoutes)
  .use(auditRoutes)

export type App = typeof app
