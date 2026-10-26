import { describe, expect, test } from "bun:test"

import {
  acceptErrorCode,
  generateInvitationToken,
  hashInvitationToken,
  isUniqueViolation,
} from "./invitation-tokens"

describe("invitation tokens", () => {
  test("are 43 URL-safe characters and unique", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateInvitationToken())
    )
    expect(tokens.size).toBe(100)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test("hash to a stable sha256 hex digest", () => {
    expect(hashInvitationToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })
})

describe("database error helpers", () => {
  test("find accept errors directly or wrapped as a cause", () => {
    expect(acceptErrorCode(new Error("invitation_used"))).toBe(
      "invitation_used"
    )
    expect(
      acceptErrorCode({
        message: "Failed query",
        cause: { message: "invitation_expired" },
      })
    ).toBe("invitation_expired")
    expect(acceptErrorCode(new Error("something else"))).toBeUndefined()
  })

  test("detect unique violations through Drizzle's wrapper", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isUniqueViolation({ code: "23505" })).toBe(true)
    expect(isUniqueViolation({ cause: { code: "23503" } })).toBe(false)
  })
})
