import { describe, expect, test } from "bun:test"

import { createClient } from "./http"
import { useServer } from "./server"

const BASE = useServer(3998)

type Org = { id: string; name: string; role: string }

describe("organizations over HTTP", () => {
  test("sign up → create org → create second → switch back", async () => {
    const request = createClient(BASE)
    await request("/api/auth/sign-up/email", {
      json: {
        name: "Owner",
        email: "org-e2e@example.com",
        password: "correct-horse-battery",
      },
    })
    const me = async () =>
      ((await (await request("/me")).json()) as { activeOrg: Org | null })
        .activeOrg

    const first = (await (
      await request("/organizations", { json: { name: "บ้านเช่าลุงดำ" } })
    ).json()) as Org
    expect(first.role).toBe("owner")
    expect((await me())?.id).toBe(first.id)

    const second = (await (
      await request("/organizations", { json: { name: "อพาร์ทเม้นท์ป้าแดง" } })
    ).json()) as Org
    expect((await me())?.id).toBe(second.id)

    const switched = await request("/organizations/active", {
      json: { orgId: first.id },
    })
    expect(switched.status).toBe(200)
    expect((await me())?.id).toBe(first.id)
  })
})
