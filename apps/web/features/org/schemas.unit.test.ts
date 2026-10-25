import { describe, expect, test } from "bun:test"

import { orgNameSchema } from "./schemas"

describe("orgNameSchema", () => {
  test("follows the API's 200-character limit after trimming", () => {
    expect(orgNameSchema.parse(` ${"ก".repeat(200)} `)).toBe("ก".repeat(200))
    expect(orgNameSchema.safeParse("ก".repeat(201)).success).toBe(false)
  })

  test("rejects blank names", () => {
    expect(orgNameSchema.safeParse("   ").error?.issues[0]?.message).toBe(
      "กรุณากรอกชื่อกิจการ"
    )
  })
})
