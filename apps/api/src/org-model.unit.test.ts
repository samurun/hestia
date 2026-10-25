import { describe, expect, test } from "bun:test"

import { checkOrgAccess, pickDefaultOrg, type OrgMembership } from "./org-model"

const a = { id: "a" }
const b = { id: "b" }

describe("pickDefaultOrg", () => {
  test("restores the last-used org while still a member", () => {
    expect(pickDefaultOrg("b", [a, b])).toBe("b")
  })

  test("falls back to the only org", () => {
    expect(pickDefaultOrg(null, [a])).toBe("a")
    expect(pickDefaultOrg("gone", [a])).toBe("a")
  })

  test("returns null when the choice is ambiguous or there are no orgs", () => {
    expect(pickDefaultOrg(null, [a, b])).toBeNull()
    expect(pickDefaultOrg("gone", [a, b])).toBeNull()
    expect(pickDefaultOrg(null, [])).toBeNull()
  })
})

describe("checkOrgAccess", () => {
  const membership: OrgMembership = { id: "a", name: "A", role: "staff" }

  test("allows a member of the active org", () => {
    expect(checkOrgAccess("a", membership)).toEqual({
      ok: true,
      org: membership,
    })
  })

  test("rejects when no org is active", () => {
    expect(checkOrgAccess(null, membership)).toEqual({
      ok: false,
      message: "No active organization",
    })
  })

  test("rejects a missing membership", () => {
    expect(checkOrgAccess("a", null)).toEqual({
      ok: false,
      message: "Not a member of this organization",
    })
  })
})
