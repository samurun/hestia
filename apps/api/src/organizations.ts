import { eq, schema, withContext } from "@workspace/db"
import {
  createOrganizationBody,
  messageError,
  setActiveOrganizationBody,
  validationError,
} from "@workspace/shared/schemas"
import { Elysia } from "elysia"
import { z } from "zod"

import { createAuditor } from "./audit"
import { db } from "./db"
import { findMembership, listMemberships, setActiveOrg } from "./memberships"
import { NOT_MEMBER, OrgMembership } from "./org-model"
import { authPlugin } from "./plugins/auth"
import { orgPlugin } from "./plugins/org"

const { defaultOrgSettings, memberships, organizations } = schema

const OrgSettings = z.object({
  graceDays: z.int(),
  lateFeePerDay: z.int(),
  lateFeeCap: z.int().nullable(),
  bookingExpiryDays: z.int(),
  bookingForfeitOnCancel: z.boolean(),
})

const CurrentOrganization = OrgMembership.extend({
  taxId: z.string().nullable(),
  branchCode: z.string(),
  isVatRegistered: z.boolean(),
  address: z.string().nullable(),
  promptpayId: z.string().nullable(),
  settings: OrgSettings,
})
const notMember = { message: NOT_MEMBER }

export const organizationRoutes = new Elysia({ prefix: "/organizations" })
  .use(authPlugin)
  .get("/", ({ user }) => listMemberships(user.id), {
    auth: true,
    response: { 200: z.array(OrgMembership), 401: messageError },
    detail: { tags: ["Organizations"], summary: "List my organizations" },
  })
  .post(
    "/",
    async ({ user, session, body, status, request, server }) => {
      // The id is generated here so app.org_id can be set before the insert;
      // RLS rejects rows whose org isn't the current one.
      const orgId = Bun.randomUUIDv7()
      const org = await withContext(
        db,
        { orgId, userId: user.id },
        async (tx) => {
          const [created] = await tx
            .insert(organizations)
            .values({ id: orgId, name: body.name })
            .returning({ id: organizations.id, name: organizations.name })
          await tx
            .insert(memberships)
            .values({ orgId, userId: user.id, role: "owner" })
          const audit = createAuditor({
            orgId,
            actorId: user.id,
            request,
            server,
          })
          await audit(tx, {
            action: "organization.create",
            entity: "organization",
            entityId: orgId,
            after: created,
          })
          await setActiveOrg(tx, {
            sessionId: session.id,
            userId: user.id,
            orgId,
          })
          return created!
        }
      )
      return status(201, { ...org, role: "owner" as const })
    },
    {
      auth: true,
      // Trims before checking length, so the limit applies to what is stored.
      body: createOrganizationBody,
      response: {
        201: OrgMembership,
        401: messageError,
        422: validationError,
      },
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
      const switched = await withContext(db, { userId: user.id }, (tx) =>
        setActiveOrg(tx, {
          sessionId: session.id,
          userId: user.id,
          orgId: body.orgId,
        })
      )
      const org = switched && (await findMembership(user.id, body.orgId))
      return org || status(403, notMember)
    },
    {
      auth: true,
      body: setActiveOrganizationBody,
      response: {
        200: OrgMembership,
        401: messageError,
        403: messageError,
        422: validationError,
      },
      detail: {
        tags: ["Organizations"],
        summary: "Switch active organization",
      },
    }
  )

/** Routes that act on the session's active org. */
export const currentOrganizationRoutes = new Elysia({ prefix: "/organization" })
  .use(orgPlugin)
  .get(
    "/",
    async ({ org, orgTx, status }) => {
      const [row] = await orgTx((tx) =>
        tx
          .select({
            taxId: organizations.taxId,
            branchCode: organizations.branchCode,
            isVatRegistered: organizations.isVatRegistered,
            address: organizations.address,
            promptpayId: organizations.promptpayId,
            settings: organizations.settings,
          })
          .from(organizations)
          .where(eq(organizations.id, org.id))
      )
      if (!row) return status(403, notMember)
      // Settings rows written before a key existed fall back to defaults.
      return {
        ...org,
        ...row,
        settings: { ...defaultOrgSettings, ...row.settings },
      }
    },
    {
      org: true,
      response: {
        200: CurrentOrganization,
        401: messageError,
        403: messageError,
      },
      detail: {
        tags: ["Organizations"],
        summary: "Active organization details",
      },
    }
  )
