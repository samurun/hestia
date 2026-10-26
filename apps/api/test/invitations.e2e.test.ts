import { describe, expect, test } from "bun:test"

import { signUp } from "./org-fixture"
import { useServer } from "./server"

const BASE = useServer(3995)

describe("invitations over HTTP", () => {
  test("owner invites → invitee signs up → accepts → is a member", async () => {
    const owner = await signUp(BASE, "inv-e2e-owner@example.com")
    await owner.request("/organizations", { json: { name: "Invite Org" } })

    const created = await owner.request("/invitations", {
      json: { email: "inv-e2e-staff@example.com", role: "manager" },
    })
    expect(created.status).toBe(201)
    const { url } = (await created.json()) as { url: string }
    expect(url).toStartWith("http://localhost:3000/invite/")
    const token = url.split("/invite/")[1]!

    const invitee = await signUp(BASE, "inv-e2e-staff@example.com")
    const accepted = await invitee.request("/invitations/accept", {
      json: { token },
    })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({
      name: "Invite Org",
      role: "manager",
    })

    const members = (await (await owner.request("/memberships")).json()) as {
      role: string
      user: { email: string }
    }[]
    expect(members.map((m) => [m.user.email, m.role])).toEqual([
      ["inv-e2e-owner@example.com", "owner"],
      ["inv-e2e-staff@example.com", "manager"],
    ])
  })
})
