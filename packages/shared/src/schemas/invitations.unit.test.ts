import { describe, expect, test } from "bun:test"

import { createInvitationBody, invitationToken } from "./invitations"

describe("createInvitationBody", () => {
  test("lowercases the email and defaults propertyIds", () => {
    expect(
      createInvitationBody.parse({ email: "Staff@Example.COM", role: "staff" })
    ).toEqual({ email: "staff@example.com", role: "staff", propertyIds: [] })
  })

  test("rejects unknown roles with a Thai message", () => {
    const result = createInvitationBody.safeParse({
      email: "a@example.com",
      role: "admin",
    })
    expect(result.error?.issues[0]?.message).toBe("บทบาทไม่ถูกต้อง")
  })
})

describe("invitationToken", () => {
  test("accepts only 43-character base64url tokens", () => {
    expect(invitationToken.safeParse("a".repeat(43)).success).toBe(true)
    expect(invitationToken.safeParse("a".repeat(42)).success).toBe(false)
    expect(invitationToken.safeParse(`${"a".repeat(42)}/`).success).toBe(false)
  })
})
