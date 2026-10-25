import { describe, expect, test } from "bun:test"

import { email, newPassword, orgName, personName, uuid } from "./fields"

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

describe("field schemas", () => {
  test("orgName trims and allows 200 characters", () => {
    expect(orgName.parse(` ${"ก".repeat(200)} `)).toBe("ก".repeat(200))
    expect(message(orgName.safeParse("ก".repeat(201)))).toBe(
      "ชื่อกิจการยาวได้ไม่เกิน 200 ตัวอักษร"
    )
    expect(message(orgName.safeParse("   "))).toBe("กรุณากรอกชื่อกิจการ")
  })

  test("personName trims and is required", () => {
    expect(personName.parse("  สมชาย ")).toBe("สมชาย")
    expect(message(personName.safeParse(" "))).toBe("กรุณากรอกชื่อ")
  })

  test("email and uuid give Thai messages", () => {
    expect(message(email.safeParse("nope"))).toBe("รูปแบบอีเมลไม่ถูกต้อง")
    expect(message(uuid.safeParse("nope"))).toBe("รหัสอ้างอิงไม่ถูกต้อง")
  })

  test("newPassword follows the shared length rules", () => {
    expect(newPassword.safeParse("1234567").success).toBe(false)
    expect(newPassword.safeParse("12345678").success).toBe(true)
    expect(newPassword.safeParse("x".repeat(129)).success).toBe(false)
  })
})
