import { describe, expect, test } from "bun:test"

import { orgWithTeam } from "./org-fixture"
import { useServer } from "./server"

const BASE = useServer(3997)

describe("rbac over HTTP", () => {
  test("owner assigns properties; manager and staff cannot", async () => {
    const { owner, manager, staff, properties } = await orgWithTeam(
      BASE,
      "rbac-e2e"
    )
    const assign = (request: typeof owner.request) =>
      request(`/memberships/${staff.membershipId}/properties`, {
        method: "PUT",
        json: { propertyIds: [properties.x] },
      })

    const res = await assign(owner.request)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      membershipId: staff.membershipId,
      propertyIds: [properties.x],
    })
    expect((await assign(manager.request)).status).toBe(403)
    expect((await assign(staff.request)).status).toBe(403)
  })
})
