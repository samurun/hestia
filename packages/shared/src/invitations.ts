// Invitation rules shared by the API (status, emails, errors) and the web
// (labels, invite page). The database enforces the same expiry in
// app_accept_invitation.

export const INVITATION_TTL_DAYS = 7

export const invitationStatuses = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const
export type InvitationStatus = (typeof invitationStatuses)[number]

export function invitationStatus(
  invitation: {
    acceptedAt: Date | null
    revokedAt: Date | null
    expiresAt: Date
  },
  now = new Date()
): InvitationStatus {
  if (invitation.acceptedAt) return "accepted"
  if (invitation.revokedAt) return "revoked"
  if (invitation.expiresAt <= now) return "expired"
  return "pending"
}

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  pending: "รอตอบรับ",
  accepted: "เข้าร่วมแล้ว",
  revoked: "ยกเลิกแล้ว",
  expired: "หมดอายุ",
}

/** Why an invite can't be used any more. */
export const invitationClosedMessages: Record<
  Exclude<InvitationStatus, "pending">,
  string
> = {
  accepted: "คำเชิญนี้ถูกใช้ไปแล้ว",
  revoked: "คำเชิญนี้ถูกยกเลิกแล้ว",
  expired: "คำเชิญนี้หมดอายุแล้ว ขอให้เจ้าของส่งคำเชิญใหม่",
}
