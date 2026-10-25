import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { sql } from "@workspace/db"
import { Elysia, t } from "elysia"

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
        200: t.Object({ status: t.Literal("ok"), db: t.Literal("up") }),
        503: t.Object({ status: t.Literal("error"), db: t.Literal("down") }),
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
        200: t.Object({
          user: t.Object({
            id: t.String({ format: "uuid" }),
            name: t.String(),
            email: t.String({ format: "email" }),
          }),
          activeOrg: t.Nullable(OrgMembership),
        }),
        401: t.Object({ message: t.String() }),
      },
      detail: { tags: ["Auth"], summary: "Current user and active org" },
    }
  )
  .use(organizationRoutes)
  .use(currentOrganizationRoutes)
  .use(membershipRoutes)

export type App = typeof app
