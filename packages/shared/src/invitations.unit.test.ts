import { describe, expect, test } from "bun:test"

import { invitationStatus } from "./invitations"

describe("invitationStatus", () => {
  const now = new Date("2026-10-26T00:00:00Z")
  const later = new Date("2026-10-27T00:00:00Z")
  const earlier = new Date("2026-10-25T00:00:00Z")
  const open = { acceptedAt: null, revokedAt: null, expiresAt: later }

  test("pending until it expires", () => {
    expect(invitationStatus(open, now)).toBe("pending")
    expect(invitationStatus({ ...open, expiresAt: now }, now)).toBe("expired")
    expect(invitationStatus({ ...open, expiresAt: earlier }, now)).toBe(
      "expired"
    )
  })

  test("accepted and revoked win over expiry", () => {
    const expired = { ...open, expiresAt: earlier }
    expect(invitationStatus({ ...expired, acceptedAt: earlier }, now)).toBe(
      "accepted"
    )
    expect(invitationStatus({ ...expired, revokedAt: earlier }, now)).toBe(
      "revoked"
    )
  })
})
