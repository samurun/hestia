import { z } from "zod"

import { invitationStatuses } from "../invitations"
import { memberRoles } from "../rbac"
import { email, uuid } from "./fields"

export const memberRole = z.enum(memberRoles, "บทบาทไม่ถูกต้อง")

export const invitationStatusSchema = z.enum(invitationStatuses)

export const createInvitationBody = z.object({
  // Stored lowercased: the invitee must sign in with the same address.
  email: email.toLowerCase(),
  role: memberRole,
  propertyIds: z
    .array(uuid)
    .max(500, "มอบหมายได้ไม่เกิน 500 โครงการในครั้งเดียว")
    .default([]),
})

export const invitationParams = z.object({ invitationId: uuid })

/** Tokens are 43 base64url characters; anything else can't match. */
export const invitationToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "ลิงก์คำเชิญไม่ถูกต้อง")

export const invitationTokenParams = z.object({ token: invitationToken })

export const acceptInvitationBody = z.object({ token: invitationToken })
