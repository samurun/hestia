import { describe, expect, test } from "bun:test"

import { signUp } from "./org-fixture"
import { useServer } from "./server"

const BASE = useServer(3996)

describe("audit log over HTTP", () => {
  test("creating an org is logged with the caller and their IP", async () => {
    const owner = await signUp(BASE, "audit-e2e@example.com")
    await owner.request("/organizations", { json: { name: "Audited Org" } })

    const res = await owner.request("/audit-logs")
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as {
      items: { action: string; ip: string | null; actor: { email: string } }[]
    }
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      action: "organization.create",
      actor: { email: "audit-e2e@example.com" },
    })
    expect(["127.0.0.1", "::1", "::ffff:127.0.0.1"]).toContain(items[0]!.ip!)
  })
})
