import { describe, expect, test } from "bun:test"

import "../test/env"

import { resolveActiveOrg, type OrgMembership } from "./organizations"

const orgs: OrgMembership[] = [
  { id: "a", name: "A", role: "owner" },
  { id: "b", name: "B", role: "staff" },
]

describe("resolveActiveOrg", () => {
  test("returns the membership for the active org", () => {
    expect(resolveActiveOrg("b", orgs)).toEqual(orgs[1]!)
  })

  test("returns null when no org is active", () => {
    expect(resolveActiveOrg(null, orgs)).toBeNull()
    expect(resolveActiveOrg(undefined, orgs)).toBeNull()
  })

  test("returns null when the user is no longer a member", () => {
    expect(resolveActiveOrg("gone", orgs)).toBeNull()
  })
})
