import { and, desc, eq, inArray, isNull, schema, sql } from "@workspace/db"
import {
  INVITATION_TTL_DAYS,
  invitationStatus,
  roleLabels,
} from "@workspace/shared"
import {
  acceptInvitationBody,
  createInvitationBody,
  invitationParams,
  invitationStatusSchema,
  invitationTokenParams,
  memberRole,
  messageError,
  uuid,
  validationError,
} from "@workspace/shared/schemas"
import { Elysia, status } from "elysia"
import { z } from "zod"

import { requestIp } from "./audit"
import { db } from "./db"
import { env } from "./env"
import {
  acceptErrorCode,
  acceptErrors,
  generateInvitationToken,
  hashInvitationToken,
  isUniqueViolation,
} from "./invitation-tokens"
import { sendMail } from "./mailer"
import { findMembership } from "./memberships"
import { OrgMembership } from "./org-model"
import { rbacPlugin } from "./plugins/rbac"

const { invitations, memberships, properties, users } = schema

const Invitation = z.object({
  id: uuid,
  email: z.string(),
  role: memberRole,
  propertyIds: z.array(uuid),
  status: invitationStatusSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
})

const invitationFields = {
  id: invitations.id,
  email: invitations.email,
  role: invitations.role,
  propertyIds: invitations.propertyIds,
  expiresAt: invitations.expiresAt,
  acceptedAt: invitations.acceptedAt,
  revokedAt: invitations.revokedAt,
  createdAt: invitations.createdAt,
}

type InvitationRow = {
  id: string
  email: string
  role: z.infer<typeof memberRole>
  propertyIds: string[]
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

const toInvitation = (row: InvitationRow) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  propertyIds: row.propertyIds,
  status: invitationStatus(row),
  expiresAt: row.expiresAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
})

export const invitationRoutes = new Elysia({ prefix: "/invitations" })
  .use(rbacPlugin)
  .get(
    "/",
    async ({ orgTx }) =>
      (
        await orgTx((tx) =>
          tx
            .select(invitationFields)
            .from(invitations)
            .orderBy(desc(invitations.createdAt))
            .limit(200)
        )
      ).map(toInvitation),
    {
      org: true,
      permission: "members.manage",
      response: {
        200: z.array(Invitation),
        401: messageError,
        403: messageError,
      },
      detail: { tags: ["Members"], summary: "List invitations (owners)" },
    }
  )
  .post(
    "/",
    async ({ body, org, user, orgTx, audit, status }) => {
      const token = generateInvitationToken()
      const invitation = await orgTx(async (tx) => {
        // Serialize invites for the same address, so a double submit (or two
        // owners) replaces cleanly instead of racing on the open-invite index.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`invitation:${org.id}:${body.email}`}, 0))`
        )
        const [existing] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(sql`lower(${users.email}) = ${body.email}`)
        if (existing) {
          throw status(409, { message: "อีเมลนี้เป็นสมาชิกขององค์กรอยู่แล้ว" })
        }

        const propertyIds = [...new Set(body.propertyIds)]
        if (propertyIds.length > 0) {
          // Owners see every property in the org under RLS.
          const found = await tx
            .select({ id: properties.id })
            .from(properties)
            .where(inArray(properties.id, propertyIds))
          if (found.length !== propertyIds.length) {
            throw status(422, { message: "ไม่พบโครงการที่เลือก" })
          }
        }

        // A new invite replaces any open one for the same address.
        await tx
          .update(invitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(invitations.email, body.email),
              isNull(invitations.acceptedAt),
              isNull(invitations.revokedAt)
            )
          )
        const [created] = await tx
          .insert(invitations)
          .values({
            orgId: org.id,
            email: body.email,
            role: body.role,
            propertyIds,
            tokenHash: hashInvitationToken(token),
            invitedBy: user.id,
            expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
          })
          .returning(invitationFields)
        await audit(tx, {
          action: "invitation.create",
          entity: "invitation",
          entityId: created!.id,
          after: { email: body.email, role: body.role, propertyIds },
        })
        return created!
      }).catch((error) => {
        if (isUniqueViolation(error)) {
          throw status(409, {
            message: "มีคำเชิญที่กำลังส่งถึงอีเมลนี้อยู่ ลองใหม่อีกครั้ง",
          })
        }
        throw error
      })

      const url = `${env.WEB_ORIGIN}/invite/${token}`
      await sendMail({
        to: invitation.email,
        subject: `คุณได้รับเชิญเข้าร่วม ${org.name} บน Hestia`,
        text: `${user.name} เชิญคุณเป็น${roleLabels[invitation.role]}ของ ${org.name}\nเปิดลิงก์นี้ภายใน ${INVITATION_TTL_DAYS} วัน: ${url}`,
      })
      // The link is also returned so an owner can share it themselves (e.g.
      // over LINE) until email delivery exists.
      return status(201, { invitation: toInvitation(invitation), url })
    },
    {
      org: true,
      permission: "members.manage",
      body: createInvitationBody,
      response: {
        201: z.object({ invitation: Invitation, url: z.url() }),
        401: messageError,
        403: messageError,
        409: messageError,
        422: z.union([validationError, messageError]),
      },
      detail: {
        tags: ["Members"],
        summary: "Invite someone (owners)",
        description: `Replaces any open invite for the same email. The link expires in ${INVITATION_TTL_DAYS} days.`,
      },
    }
  )
  .delete(
    "/:invitationId",
    ({ params, orgTx, audit }) =>
      orgTx(async (tx) => {
        const [revoked] = await tx
          .update(invitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(invitations.id, params.invitationId),
              isNull(invitations.acceptedAt),
              isNull(invitations.revokedAt)
            )
          )
          .returning(invitationFields)
        if (!revoked)
          throw status(404, { message: "ไม่พบคำเชิญที่ยังเปิดอยู่" })
        await audit(tx, {
          action: "invitation.revoke",
          entity: "invitation",
          entityId: revoked.id,
          before: { email: revoked.email, role: revoked.role },
        })
        return toInvitation(revoked)
      }),
    {
      org: true,
      permission: "members.manage",
      params: invitationParams,
      response: {
        200: Invitation,
        401: messageError,
        403: messageError,
        404: messageError,
        422: validationError,
      },
      detail: { tags: ["Members"], summary: "Revoke an invitation (owners)" },
    }
  )
  .get(
    "/preview/:token",
    async ({ params, status }) => {
      const [preview] = await db.execute<{
        org_name: string
        email: string
        role: z.infer<typeof memberRole>
        expires_at: string
        accepted_at: string | null
        revoked_at: string | null
      }>(
        sql`select * from app_invitation_preview(${hashInvitationToken(params.token)})`
      )
      if (!preview) return status(404, { message: "ไม่พบคำเชิญนี้" })
      const date = (value: string | null) => (value ? new Date(value) : null)
      return {
        orgName: preview.org_name,
        email: preview.email,
        role: preview.role,
        status: invitationStatus({
          expiresAt: new Date(preview.expires_at),
          acceptedAt: date(preview.accepted_at),
          revokedAt: date(preview.revoked_at),
        }),
      }
    },
    {
      params: invitationTokenParams,
      response: {
        200: z.object({
          orgName: z.string(),
          email: z.string(),
          role: memberRole,
          status: invitationStatusSchema,
        }),
        404: messageError,
        422: validationError,
      },
      detail: {
        tags: ["Members"],
        summary: "Invitation preview (public, by token)",
      },
    }
  )
  .post(
    "/accept",
    async ({ body, user, session, request, server, status }) => {
      // One call, one transaction: membership, property assignments, the
      // session switch and the audit row commit (or fail) together.
      let orgId: string
      try {
        const [row] = await db.execute<{ org_id: string }>(
          sql`select app_accept_invitation(${hashInvitationToken(body.token)}, ${user.id}, ${session.id}, ${requestIp(request, server)}::inet) as org_id`
        )
        orgId = row!.org_id
      } catch (error) {
        const code = acceptErrorCode(error)
        if (!code) throw error
        const { status: httpStatus, message } = acceptErrors[code]!
        return status(httpStatus, { message })
      }

      const membership = await findMembership(user.id, orgId)
      if (!membership) throw new Error("accepted invitation has no membership")
      return membership
    },
    {
      auth: true,
      body: acceptInvitationBody,
      response: {
        200: OrgMembership,
        401: messageError,
        403: messageError,
        404: messageError,
        409: messageError,
        410: messageError,
        422: validationError,
      },
      detail: {
        tags: ["Members"],
        summary: "Accept an invitation",
        description:
          "The signed-in user's email must match the invitation. Switches the session to the new org.",
      },
    }
  )
