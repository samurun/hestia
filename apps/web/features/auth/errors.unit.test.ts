import { describe, expect, test } from "bun:test"

import { authErrorMessage } from "./errors"

describe("authErrorMessage", () => {
  test("translates known Better Auth codes", () => {
    expect(authErrorMessage("INVALID_EMAIL_OR_PASSWORD")).toBe(
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
    )
    expect(authErrorMessage("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toContain(
      "มีบัญชีอยู่แล้ว"
    )
  })

  test("falls back to a generic message", () => {
    expect(authErrorMessage(undefined)).toBe(
      "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    )
    expect(authErrorMessage("SOMETHING_NEW")).toBe(
      "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    )
  })
})
