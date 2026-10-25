import { describe, expect, test } from "bun:test"

import { pickDefaultOrg } from "./org-model"

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
