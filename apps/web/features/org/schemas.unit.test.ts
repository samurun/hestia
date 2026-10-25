import { describe, expect, test } from "bun:test"

import { parseForm } from "@/lib/form"

import { createOrgSchema } from "./schemas"

const form = (orgName: string) => {
  const data = new FormData()
  data.set("orgName", orgName)
  return data
}

describe("createOrgSchema", () => {
  test("uses the shared org name rules", () => {
    expect(parseForm(createOrgSchema, form(" บ้านเช่า "))).toEqual({
      success: true,
      data: { orgName: "บ้านเช่า" },
    })
    expect(parseForm(createOrgSchema, form("   "))).toEqual({
      success: false,
      errors: { orgName: [{ message: "กรุณากรอกชื่อกิจการ" }] },
    })
  })
})
