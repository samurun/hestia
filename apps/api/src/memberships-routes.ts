import { eq, inArray, schema } from "@workspace/db"
import {
  membershipParams,
  messageError,
  setMembershipPropertiesBody,
  uuid,
  validationError,
} from "@workspace/shared/schemas"
import { Elysia, status } from "elysia"
import { z } from "zod"

import { rbacPlugin } from "./plugins/rbac"
import { can } from "./rbac"

const { membershipProperties, memberships, properties } = schema

export const membershipRoutes = new Elysia({ prefix: "/memberships" })
  .use(rbacPlugin)
  .put(
    "/:membershipId/properties",
    ({ params, body, org, orgTx, audit }) =>
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
        await audit(tx, {
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
      params: membershipParams,
      body: setMembershipPropertiesBody,
      response: {
        200: z.object({ membershipId: uuid, propertyIds: z.array(uuid) }),
        401: messageError,
        403: messageError,
        404: messageError,
        // Request validation, or an owner / unknown-property rejection.
        422: z.union([validationError, messageError]),
      },
      detail: {
        tags: ["Members"],
        summary: "Set the properties a member looks after",
        description:
          "Replaces the member's property assignments. Owners only; owners already see every property.",
      },
    }
  )
