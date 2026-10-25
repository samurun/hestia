import { describe, expect, test } from "bun:test"

import { signUpBody } from "./auth"

describe("signUpBody", () => {
  test("trims the name and keeps the rest", () => {
    expect(
      signUpBody.parse({
        name: "  สมชาย ",
        email: "a@example.com",
        password: "12345678",
      })
    ).toEqual({ name: "สมชาย", email: "a@example.com", password: "12345678" })
  })

  test("rejects blank or overlong names", () => {
    const base = { email: "a@example.com", password: "12345678" }
    expect(signUpBody.safeParse({ ...base, name: "   " }).success).toBe(false)
    expect(
      signUpBody.safeParse({ ...base, name: "x".repeat(101) }).success
    ).toBe(false)
  })
})
