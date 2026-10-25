import { describe, expect, test } from "bun:test"

import { initials } from "./initials"

describe("initials", () => {
  test("first and last word", () => {
    expect(initials("Somchai Jaidee")).toBe("SJ")
    expect(initials("  ana   maria   lopez ")).toBe("AL")
  })

  test("single word and Thai names", () => {
    expect(initials("Somchai")).toBe("S")
    expect(initials("สมชาย ใจดี")).toBe("สใ")
  })

  test("empty name", () => {
    expect(initials("   ")).toBe("")
  })
})
