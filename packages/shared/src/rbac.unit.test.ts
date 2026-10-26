import { describe, expect, test } from "bun:test"

import { can, permissions, type Permission } from "./rbac"

// Mirrors the RBAC table in docs/SPEC.md §4: [owner, manager, staff].
const spec: Record<Permission, [boolean, boolean, boolean]> = {
  "org.manage": [true, false, false],
  "members.manage": [true, false, false],
  "properties.all": [true, false, false],
  "properties.manage": [true, true, false],
  "contracts.manage": [true, true, false],
  "contracts.draft": [true, true, true],
  "tenants.pii.read": [true, true, false],
  "meters.record": [true, true, true],
  "invoices.issue": [true, true, false],
  "payments.confirm": [true, true, true],
  "billing.adjust": [true, true, false],
  "maintenance.create": [true, true, true],
  "reports.finance": [true, true, false],
  "audit.read": [true, false, false],
}

describe("can", () => {
  test("every permission is covered by the spec table", () => {
    expect(Object.keys(permissions).sort()).toEqual(Object.keys(spec).sort())
  })

  for (const [permission, [owner, manager, staff]] of Object.entries(spec)) {
    test(permission, () => {
      const p = permission as Permission
      expect([can("owner", p), can("manager", p), can("staff", p)]).toEqual([
        owner,
        manager,
        staff,
      ])
    })
  }
})
