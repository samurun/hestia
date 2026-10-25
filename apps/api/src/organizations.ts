import { eq, schema, withContext } from "@workspace/db"
import { Elysia, t } from "elysia"

import { createAuditor } from "./audit"
import { db } from "./db"
import { findMembership, listMemberships, setActiveOrg } from "./memberships"
import { NOT_MEMBER, OrgMembership } from "./org-model"
import { authPlugin } from "./plugins/auth"
import { orgPlugin } from "./plugins/org"

const { defaultOrgSettings, memberships, organizations } = schema

const OrgSettings = t.Object({
  graceDays: t.Integer(),
  lateFeePerDay: t.Integer(),
  lateFeeCap: t.Nullable(t.Integer()),
  bookingExpiryDays: t.Integer(),
  bookingForfeitOnCancel: t.Boolean(),
})

const CurrentOrganization = t.Composite([
  OrgMembership,
  t.Object({
    taxId: t.Nullable(t.String()),
    branchCode: t.String(),
    isVatRegistered: t.Boolean(),
    address: t.Nullable(t.String()),
    promptpayId: t.Nullable(t.String()),
    settings: OrgSettings,
  }),
])

const Message = t.Object({ message: t.String() })
const notMember = { message: NOT_MEMBER }

export const organizationRoutes = new Elysia({ prefix: "/organizations" })
  .use(authPlugin)
  .get("/", ({ user }) => listMemberships(user.id), {
    auth: true,
    response: { 200: t.Array(OrgMembership), 401: Message },
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
      // Trim before validation so the length limit applies to what is stored.
      transform({ body }) {
        const input = body as { name?: unknown }
        if (typeof input?.name === "string") input.name = input.name.trim()
      },
      body: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
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
      body: t.Object({ orgId: t.String({ format: "uuid" }) }),
      response: { 200: OrgMembership, 401: Message, 403: Message },
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
      response: { 200: CurrentOrganization, 401: Message, 403: Message },
      detail: {
        tags: ["Organizations"],
        summary: "Active organization details",
      },
    }
  )
