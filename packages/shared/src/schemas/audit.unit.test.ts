import { describe, expect, test } from "bun:test"

import { auditLogQuery } from "./audit"

describe("auditLogQuery", () => {
  test("coerces limit and accepts an ordered range", () => {
    expect(
      auditLogQuery.parse({
        limit: "20",
        from: "2026-10-01T00:00:00Z",
        to: "2026-10-02T00:00:00Z",
      })
    ).toEqual({
      limit: 20,
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-02T00:00:00Z",
    })
  })

  test("rejects empty filters, bad limits and inverted ranges", () => {
    for (const query of [
      { action: "" },
      { entity: "" },
      { limit: "0" },
      { limit: "101" },
      { cursor: "nope" },
      { from: "2026-10-02T00:00:00Z", to: "2026-10-01T00:00:00Z" },
      { from: "2026-10-01T00:00:00Z", to: "2026-10-01T00:00:00Z" },
    ]) {
      expect(auditLogQuery.safeParse(query).success).toBe(false)
    }
  })

  test("accepts the RFC 3339 variants the API accepted before", () => {
    for (const from of [
      "2026-10-01T00:00:00Z",
      "2026-10-01 00:00:00Z",
      "2026-10-01t00:00:00z",
      "2026-10-01T07:00:00+07:00",
    ]) {
      expect(auditLogQuery.safeParse({ from }).success).toBe(true)
    }
    expect(auditLogQuery.parse({ from: "2026-10-01 00:00:00z" }).from).toBe(
      "2026-10-01T00:00:00Z"
    )
    expect(auditLogQuery.safeParse({ from: "yesterday" }).success).toBe(false)
  })
})
