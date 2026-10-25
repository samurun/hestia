import { eq, schema, withContext } from "@workspace/db"
import { Elysia, t } from "elysia"

import { db } from "./db"
import { authPlugin } from "./plugins/auth"

const { auditLogs, memberRole, memberships, organizations, sessions } = schema

export const OrgMembership = t.Object({
  id: t.String({ format: "uuid" }),
  name: t.String(),
  role: t.UnionEnum(memberRole.enumValues),
})

export type OrgMembership = typeof OrgMembership.static

const Message = t.Object({ message: t.String() })

/** Every org the user belongs to, with their role in it. */
export function listMemberships(userId: string): Promise<OrgMembership[]> {
  return withContext(db, { userId }, (tx) =>
    tx
      .select({
        id: organizations.id,
        name: organizations.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(eq(memberships.userId, userId))
      .orderBy(organizations.name)
  )
}

/**
 * The session's active org, or null when none is set or the user is no
 * longer a member of it.
 */
export function resolveActiveOrg(
  activeOrgId: string | null | undefined,
  orgs: OrgMembership[]
): OrgMembership | null {
  if (!activeOrgId) return null
  return orgs.find((org) => org.id === activeOrgId) ?? null
}

export const organizationRoutes = new Elysia({ prefix: "/organizations" })
  .use(authPlugin)
  .get("/", ({ user }) => listMemberships(user.id), {
    auth: true,
    response: { 200: t.Array(OrgMembership), 401: Message },
    detail: { tags: ["Organizations"], summary: "List my organizations" },
  })
  .post(
    "/",
    async ({ user, session, body, status }) => {
      // The id is generated here so app.org_id can be set before the insert;
      // RLS rejects rows whose org isn't the current one.
      const orgId = Bun.randomUUIDv7()
      const org = await withContext(
        db,
        { orgId, userId: user.id },
        async (tx) => {
          const [created] = await tx
            .insert(organizations)
            .values({ id: orgId, name: body.name.trim() })
            .returning({ id: organizations.id, name: organizations.name })
          await tx
            .insert(memberships)
            .values({ orgId, userId: user.id, role: "owner" })
          await tx.insert(auditLogs).values({
            orgId,
            actorId: user.id,
            action: "organization.create",
            entity: "organization",
            entityId: orgId,
            after: created,
          })
          await tx
            .update(sessions)
            .set({ activeOrgId: orgId })
            .where(eq(sessions.id, session.id))
          return created!
        }
      )
      return status(201, { ...org, role: "owner" as const })
    },
    {
      auth: true,
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200, pattern: "\\S" }),
      }),
      response: { 201: OrgMembership, 401: Message },
      detail: {
        tags: ["Organizations"],
        summary: "Create an organization",
        description:
          "Creates the organization, makes the caller its owner and switches the session to it.",
      },
    }
  )
  .post(
    "/active",
    async ({ user, session, body, status }) => {
      const org = resolveActiveOrg(body.orgId, await listMemberships(user.id))
      if (!org) {
        return status(403, { message: "Not a member of this organization" })
      }
      await db
        .update(sessions)
        .set({ activeOrgId: org.id })
        .where(eq(sessions.id, session.id))
      return org
    },
    {
      auth: true,
      body: t.Object({ orgId: t.String({ format: "uuid" }) }),
      response: { 200: OrgMembership, 401: Message, 403: Message },
      detail: {
        tags: ["Organizations"],
        summary: "Switch active organization",
      },
    }
  )
