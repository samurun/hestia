import { eq, schema, withContext } from "@workspace/db"
import type { MemberRole } from "@workspace/db/schema"

import { db } from "../src/db"
import { createClient } from "./http"

type Fetcher = (request: Request) => Response | Promise<Response>

/** Signs up a user on `baseUrl` and returns a cookie-keeping client. */
export async function signUp(
  baseUrl: string,
  email: string,
  fetcher?: Fetcher
) {
  const request = createClient(baseUrl, fetcher)
  await request("/api/auth/sign-up/email", {
    json: {
      name: email.split("@")[0],
      email,
      password: "correct-horse-battery",
    },
  })
  const me = (await (await request("/me")).json()) as { user: { id: string } }
  return { request, userId: me.user.id }
}

/**
 * An org with an owner plus a manager and a staff member who have it active,
 * and two properties. Members are added through the DB until invites (#7).
 */
export async function orgWithTeam(
  baseUrl: string,
  prefix: string,
  fetcher?: Fetcher
) {
  const owner = await signUp(baseUrl, `${prefix}-owner@example.com`, fetcher)
  const org = (await (
    await owner.request("/organizations", { json: { name: `${prefix} Org` } })
  ).json()) as { id: string }
  const asOwner = { orgId: org.id, userId: owner.userId }

  const join = async (role: MemberRole) => {
    const user = await signUp(baseUrl, `${prefix}-${role}@example.com`, fetcher)
    const [membership] = await withContext(db, asOwner, (tx) =>
      tx
        .insert(schema.memberships)
        .values({ orgId: org.id, userId: user.userId, role })
        .returning({ id: schema.memberships.id })
    )
    await user.request("/organizations/active", { json: { orgId: org.id } })
    return { ...user, membershipId: membership!.id }
  }
  const manager = await join("manager")
  const staff = await join("staff")

  const [x, y] = await withContext(db, asOwner, (tx) =>
    tx
      .insert(schema.properties)
      .values([
        { orgId: org.id, name: "Property X" },
        { orgId: org.id, name: "Property Y" },
      ])
      .returning({ id: schema.properties.id })
  )
  const [ownerMembership] = await withContext(db, asOwner, (tx) =>
    tx
      .select({ id: schema.memberships.id })
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, owner.userId))
  )

  return {
    org,
    owner: { ...owner, membershipId: ownerMembership!.id },
    manager,
    staff,
    properties: { x: x!.id, y: y!.id },
    asOwner,
  }
}
