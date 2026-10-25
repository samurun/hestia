import { eq, inArray, schema } from "@workspace/db"
import { Elysia, status, t } from "elysia"

import { rbacPlugin } from "./plugins/rbac"
import { can } from "./rbac"

const { auditLogs, membershipProperties, memberships, properties } = schema

const Message = t.Object({ message: t.String() })

export const membershipRoutes = new Elysia({ prefix: "/memberships" })
  .use(rbacPlugin)
  .put(
    "/:membershipId/properties",
    ({ params, body, org, user, orgTx }) =>
      orgTx(async (tx) => {
        // FOR UPDATE serializes concurrent replaces of the same member.
        const [member] = await tx
          .select({ id: memberships.id, role: memberships.role })
          .from(memberships)
          .where(eq(memberships.id, params.membershipId))
          .for("update")
        if (!member) throw status(404, { message: "Membership not found" })
        if (can(member.role, "properties.all")) {
          throw status(422, {
            message: "Owners already have access to every property",
          })
        }

        const propertyIds = [...new Set(body.propertyIds)]
        if (propertyIds.length > 0) {
          // Owners see every property in the org under RLS, so a short
          // result means an id from another org or a typo.
          const found = await tx
            .select({ id: properties.id })
            .from(properties)
            .where(inArray(properties.id, propertyIds))
          if (found.length !== propertyIds.length) {
            throw status(422, { message: "Unknown property" })
          }
        }

        const before = await tx
          .select({ propertyId: membershipProperties.propertyId })
          .from(membershipProperties)
          .where(eq(membershipProperties.membershipId, member.id))
        await tx
          .delete(membershipProperties)
          .where(eq(membershipProperties.membershipId, member.id))
        if (propertyIds.length > 0) {
          await tx
            .insert(membershipProperties)
            .values(
              propertyIds.map((propertyId) => ({
                orgId: org.id,
                membershipId: member.id,
                propertyId,
              }))
            )
            .onConflictDoNothing()
        }
        await tx.insert(auditLogs).values({
          orgId: org.id,
          actorId: user.id,
          action: "membership.properties.set",
          entity: "membership",
          entityId: member.id,
          before: { propertyIds: before.map((row) => row.propertyId) },
          after: { propertyIds },
        })
        return { membershipId: member.id, propertyIds }
      }),
    {
      org: true,
      permission: "members.manage",
      params: t.Object({ membershipId: t.String({ format: "uuid" }) }),
      body: t.Object({
        propertyIds: t.Array(t.String({ format: "uuid" }), { maxItems: 500 }),
      }),
      response: {
        200: t.Object({
          membershipId: t.String({ format: "uuid" }),
          propertyIds: t.Array(t.String({ format: "uuid" })),
        }),
        401: Message,
        403: Message,
        404: Message,
        422: Message,
      },
      detail: {
        tags: ["Members"],
        summary: "Set the properties a member looks after",
        description:
          "Replaces the member's property assignments. Owners only; owners already see every property.",
      },
    }
  )
