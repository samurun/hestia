import { describe, expect, test } from "bun:test"

import { safeNext } from "./safe-next"

describe("safeNext", () => {
  test("keeps paths on this site, with their query", () => {
    expect(safeNext("/onboarding")).toBe("/onboarding")
    expect(safeNext("/units?page=2")).toBe("/units?page=2")
  })

  test("falls back to / for missing or off-site values", () => {
    for (const value of [
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNext(value)).toBe("/")
    }
  })

  test("uses the first value when the key repeats", () => {
    expect(safeNext(["/a", "/b"])).toBe("/a")
  })
})
