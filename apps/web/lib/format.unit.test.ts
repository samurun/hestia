import { describe, expect, test } from "bun:test"

import { formatDate } from "./format"

describe("formatDate", () => {
  test("uses Bangkok time whatever the machine's zone", () => {
    // 20:00 UTC on 1 Nov is already 2 Nov in Bangkok.
    expect(formatDate("2026-11-01T20:00:00Z")).toBe(
      formatDate("2026-11-02T05:00:00+07:00")
    )
    expect(formatDate("2026-11-01T20:00:00Z")).toContain("2569")
  })
})
