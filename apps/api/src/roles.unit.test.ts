import { describe, expect, test } from "bun:test"

import { memberRole } from "@workspace/db/schema"
import { memberRoles } from "@workspace/shared"

describe("member roles", () => {
  test("the shared role list matches the database enum", () => {
    expect([...memberRoles]).toEqual(memberRole.enumValues)
  })
})
