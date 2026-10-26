import { describe, expect, test } from "bun:test"

import { apiErrorMessage } from "./api-error"

describe("apiErrorMessage", () => {
  test("uses the API's message", () => {
    expect(
      apiErrorMessage({ value: { message: "อีเมลนี้เป็นสมาชิกอยู่แล้ว" } })
    ).toBe("อีเมลนี้เป็นสมาชิกอยู่แล้ว")
    expect(
      apiErrorMessage({
        value: { type: "validation", on: "body", message: "บทบาทไม่ถูกต้อง" },
      })
    ).toBe("บทบาทไม่ถูกต้อง")
  })

  test("falls back when there is no usable message", () => {
    for (const error of [null, undefined, { value: "oops" }, { value: {} }]) {
      expect(apiErrorMessage(error, "fallback")).toBe("fallback")
    }
  })
})
