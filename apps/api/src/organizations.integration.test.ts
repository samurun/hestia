import { describe, expect, test } from "bun:test"

import { eq, schema, withContext, withOrg } from "@workspace/db"

import { createClient } from "../test/http"

import { app } from "./app"
import { db } from "./db"

type Org = { id: string; name: string; role: string }
type Me = { activeOrg: Org | null }

async function signedIn(email: string) {
  const request = createClient("http://localhost", (req) => app.handle(req))
  await request("/api/auth/sign-up/email", {
    json: { name: "Tester", email, password: "correct-horse-battery" },
  })
  const createOrg = async (name: string) => {
    const res = await request("/organizations", { json: { name } })
    expect(res.status).toBe(201)
    return (await res.json()) as Org
  }
  const me = async () => (await (await request("/me")).json()) as Me
  return { request, createOrg, me }
}

describe("organizations", () => {
  test("creating an org makes the caller owner and switches to it", async () => {
    const { createOrg, me } = await signedIn("create@example.com")
    expect((await me()).activeOrg).toBeNull()

    const org = await createOrg("  หอพักสมใจ  ")
    expect(org).toMatchObject({ name: "หอพักสมใจ", role: "owner" })
    expect((await me()).activeOrg).toEqual(org)

    const audit = await withOrg(db, org.id, (tx) =>
      tx.select().from(schema.auditLogs)
    )
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: "organization.create",
      entityId: org.id,
    })
  })

  test("a user can belong to several orgs and switch between them", async () => {
    const { request, createOrg, me } = await signedIn("multi@example.com")
    const first = await createOrg("B Org")
    const second = await createOrg("A Org")
    expect((await me()).activeOrg?.id).toBe(second.id)

    const list = (await (await request("/organizations")).json()) as Org[]
    expect(list.map((o) => o.name)).toEqual(["A Org", "B Org"])

    const res = await request("/organizations/active", {
      json: { orgId: first.id },
    })
    expect(res.status).toBe(200)
    expect((await me()).activeOrg?.id).toBe(first.id)
  })

  test("cannot switch to an org the user is not a member of", async () => {
    const owner = await signedIn("owner@example.com")
    const org = await owner.createOrg("Private Org")

    const other = await signedIn("other@example.com")
    for (const orgId of [org.id, crypto.randomUUID()]) {
      const res = await other.request("/organizations/active", {
        json: { orgId },
      })
      expect(res.status).toBe(403)
    }
    expect((await other.me()).activeOrg).toBeNull()
    const list = (await (await other.request("/organizations")).json()) as Org[]
    expect(list).toEqual([])
  })

  test("RLS hides other users' orgs and memberships", async () => {
    const a = await signedIn("rls-a@example.com")
    await a.createOrg("A Only")
    await signedIn("rls-b@example.com")
    const [userB] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "rls-b@example.com"))

    const seen = await withContext(db, { userId: userB!.id }, async (tx) => ({
      orgs: await tx.select().from(schema.organizations),
      memberships: await tx.select().from(schema.memberships),
    }))
    expect(seen).toEqual({ orgs: [], memberships: [] })
  })

  test("active org clears when the membership is removed", async () => {
    const { createOrg, me } = await signedIn("removed@example.com")
    const org = await createOrg("Leaving Org")
    await withOrg(db, org.id, (tx) => tx.delete(schema.memberships))
    expect((await me()).activeOrg).toBeNull()
  })

  test("rejects a blank name and unauthenticated requests", async () => {
    const { request } = await signedIn("validate@example.com")
    const blank = await request("/organizations", { json: { name: "   " } })
    expect(blank.status).toBe(422)

    const anon = createClient("http://localhost", (req) => app.handle(req))
    expect((await anon("/organizations")).status).toBe(401)
    expect((await anon("/organizations", { json: { name: "X" } })).status).toBe(
      401
    )
  })
})
