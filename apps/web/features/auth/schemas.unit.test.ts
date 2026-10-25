import { describe, expect, test } from "bun:test"

import { parseForm } from "@/lib/form"

import { loginSchema, signupSchema } from "./schemas"

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe("signupSchema", () => {
  test("trims names", () => {
    expect(
      parseForm(
        signupSchema,
        form({
          name: "  สมชาย ",
          email: "a@example.com",
          password: "12345678",
          orgName: " บ้านเช่า ",
        })
      )
    ).toEqual({
      success: true,
      data: {
        name: "สมชาย",
        email: "a@example.com",
        password: "12345678",
        orgName: "บ้านเช่า",
      },
    })
  })

  test("gives a Thai message for each invalid field", () => {
    const result = parseForm(
      signupSchema,
      form({ name: " ", email: "nope", password: "short", orgName: "" })
    )
    expect(result).toEqual({
      success: false,
      errors: {
        name: [{ message: "กรุณากรอกชื่อ" }],
        email: [{ message: "รูปแบบอีเมลไม่ถูกต้อง" }],
        password: [{ message: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }],
        orgName: [{ message: "กรุณากรอกชื่อกิจการ" }],
      },
    })
  })
})

describe("loginSchema", () => {
  test("only requires a password to be present", () => {
    expect(
      parseForm(loginSchema, form({ email: "a@example.com", password: "x" }))
        .success
    ).toBe(true)
    expect(
      parseForm(loginSchema, form({ email: "a@example.com", password: "" }))
    ).toEqual({
      success: false,
      errors: { password: [{ message: "กรุณากรอกรหัสผ่าน" }] },
    })
  })
})
