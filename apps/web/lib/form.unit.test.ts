import { describe, expect, test } from "bun:test"
import { z } from "zod"

import { parseForm } from "./form"

const schema = z.object({
  name: z.string().trim().min(1, "required"),
  code: z.string().min(3, "too short").regex(/^\d+$/, "digits only"),
})

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe("parseForm", () => {
  test("returns parsed data when valid", () => {
    expect(parseForm(schema, form({ name: " a ", code: "123" }))).toEqual({
      success: true,
      data: { name: "a", code: "123" },
    })
  })

  test("groups every issue under its field", () => {
    const result = parseForm(schema, form({ name: " ", code: "a" }))
    expect(result).toEqual({
      success: false,
      errors: {
        name: [{ message: "required" }],
        code: [{ message: "too short" }, { message: "digits only" }],
      },
    })
  })

  test("treats missing fields as errors", () => {
    const result = parseForm(schema, form({}))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(Object.keys(result.errors).sort()).toEqual(["code", "name"])
  })
})
