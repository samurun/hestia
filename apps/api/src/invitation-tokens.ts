import { invitationClosedMessages } from "@workspace/shared"

// Pure helpers for invitation links; no DB imports, so unit tests stay light.

/** 32 random bytes as base64url: 43 characters, URL-safe, unguessable. */
export function generateInvitationToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url"
  )
}

/** Only this hash is stored, so the table alone can't produce valid links. */
export function hashInvitationToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex")
}

/** HTTP status + Thai message for each error app_accept_invitation raises. */
export const acceptErrors: Record<
  string,
  { status: 403 | 404 | 409 | 410; message: string }
> = {
  invitation_not_found: { status: 404, message: "ไม่พบคำเชิญนี้" },
  invitation_used: { status: 409, message: invitationClosedMessages.accepted },
  invitation_revoked: {
    status: 410,
    message: invitationClosedMessages.revoked,
  },
  invitation_expired: {
    status: 410,
    message: invitationClosedMessages.expired,
  },
  invitation_email_mismatch: {
    status: 403,
    message: "คำเชิญนี้ส่งถึงอีเมลอื่น กรุณาเข้าสู่ระบบด้วยอีเมลที่ได้รับเชิญ",
  },
  already_member: { status: 409, message: "คุณเป็นสมาชิกขององค์กรนี้อยู่แล้ว" },
}

/** The error message raised by app_accept_invitation, if it was one. */
export function acceptErrorCode(error: unknown): string | undefined {
  const messages = [error, (error as { cause?: unknown })?.cause].map(
    (e) => (e as { message?: string } | undefined)?.message
  )
  return messages.find((m) => m !== undefined && m in acceptErrors)
}

/** Postgres unique_violation, possibly wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown })?.cause].some(
    (e) => (e as { code?: string } | undefined)?.code === "23505"
  )
}
