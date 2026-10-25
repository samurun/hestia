import { describe, expect, test } from "bun:test"

import { eq, schema, withContext } from "@workspace/db"
import { Elysia, t } from "elysia"

import { createClient } from "../test/http"

import { app } from "./app"
import { db } from "./db"
import { orgPlugin } from "./plugins/org"

type Org = { id: string; name: string; role: string }

// A route that takes an org id straight from the URL, to prove orgTx stays
// inside the active org whatever the caller asks for.
const probe = new Elysia()
  .use(orgPlugin)
  .get(
    "/probe/org/:id",
    ({ orgTx, params }) =>
      orgTx((tx) =>
        tx
          .select({ id: schema.organizations.id })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, params.id))
      ),
    { org: true, params: t.Object({ id: t.String() }) }
  )
  .get(
    "/probe/memberships",
    ({ orgTx }) =>
      orgTx((tx) =>
        tx.select({ orgId: schema.memberships.orgId }).from(schema.memberships)
      ),
    { org: true }
  )
  // Removes the caller after resolve() has passed, then uses orgTx.
  .post(
    "/probe/removed-mid-request",
    async ({ org, user, orgTx, body }) => {
      await withContext(db, { orgId: org.id, userId: body.ownerId }, (tx) =>
        tx
          .delete(schema.memberships)
          .where(eq(schema.memberships.userId, user.id))
      )
      return orgTx((tx) => tx.select().from(schema.organizations))
    },
    { org: true, body: t.Object({ ownerId: t.String() }) }
  )

const handle = (req: Request) =>
  new URL(req.url).pathname.startsWith("/probe")
    ? probe.handle(req)
    : app.handle(req)

async function signedIn(email: string) {
  const request = createClient("http://localhost", handle)
  await request("/api/auth/sign-up/email", {
    json: { name: "Tester", email, password: "correct-horse-battery" },
  })
  const createOrg = async (name: string) =>
    (await (await request("/organizations", { json: { name } })).json()) as Org
  const userId = (
    (await (await request("/me")).json()) as { user: { id: string } }
  ).user.id
  return { request, createOrg, userId }
}

function addStaff(orgId: string, ownerId: string, userId: string) {
  return withContext(db, { orgId, userId: ownerId }, (tx) =>
    tx.insert(schema.memberships).values({ orgId, userId, role: "staff" })
  )
}

describe("org context", () => {
  test("GET /organization returns the active org with the caller's role", async () => {
    const { request, createOrg } = await signedIn("ctx-details@example.com")
    const org = await createOrg("หอพักใจดี")

    const res = await request("/organization")
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: org.id,
      name: "หอพักใจดี",
      role: "owner",
      branchCode: "00000",
      isVatRegistered: false,
      settings: { graceDays: 0, bookingExpiryDays: 7 },
    })
  })

  test("requires sign-in and an active org", async () => {
    const anon = createClient("http://localhost", handle)
    expect((await anon("/organization")).status).toBe(401)

    const { request } = await signedIn("ctx-noorg@example.com")
    const res = await request("/organization")
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: "No active organization" })
  })

  test("a session pointing at another org is rejected", async () => {
    const victim = await signedIn("ctx-victim@example.com")
    const victimOrg = await victim.createOrg("Victim Org")
    const attacker = await signedIn("ctx-attacker@example.com")

    // Simulate a tampered or stale session row.
    await db
      .update(schema.sessions)
      .set({ activeOrgId: victimOrg.id })
      .where(eq(schema.sessions.userId, attacker.userId))

    const res = await attacker.request("/organization")
    expect(res.status).toBe(403)
    expect(JSON.stringify(await res.json())).not.toContain("Victim Org")
    expect((await attacker.request(`/probe/org/${victimOrg.id}`)).status).toBe(
      403
    )
  })

  test("orgTx cannot read another org even when asked for its id", async () => {
    const a = await signedIn("ctx-a@example.com")
    const orgA = await a.createOrg("Org A")
    const b = await signedIn("ctx-b@example.com")
    const orgB = await b.createOrg("Org B")

    const own = await a.request(`/probe/org/${orgA.id}`)
    expect(await own.json()).toEqual([{ id: orgA.id }])

    const other = await a.request(`/probe/org/${orgB.id}`)
    expect(other.status).toBe(200)
    expect(await other.json()).toEqual([])
  })

  test("the context follows org switches and membership removal", async () => {
    const owner = await signedIn("ctx-owner@example.com")
    const shared = await owner.createOrg("Shared")
    const member = await signedIn("ctx-member@example.com")
    const own = await member.createOrg("Own")
    await addStaff(shared.id, owner.userId, member.userId)

    const current = async () =>
      (await (await member.request("/organization")).json()) as Org
    expect((await current()).id).toBe(own.id)

    await member.request("/organizations/active", {
      json: { orgId: shared.id },
    })
    expect(await current()).toMatchObject({ id: shared.id, role: "staff" })

    await withContext(db, { orgId: shared.id, userId: owner.userId }, (tx) =>
      tx
        .delete(schema.memberships)
        .where(eq(schema.memberships.userId, member.userId))
    )
    expect((await member.request("/organization")).status).toBe(403)
  })

  test("orgTx hides other orgs the caller IS a member of", async () => {
    const owner = await signedIn("ctx-both-owner@example.com")
    const other = await owner.createOrg("Other Org")
    const member = await signedIn("ctx-both-member@example.com")
    const active = await member.createOrg("Active Org")
    await addStaff(other.id, owner.userId, member.userId)

    const probed = await member.request(`/probe/org/${other.id}`)
    expect(await probed.json()).toEqual([])

    const memberships = await member.request("/probe/memberships")
    expect(await memberships.json()).toEqual([{ orgId: active.id }])
  })

  test("GET /organization returns the active org's own details", async () => {
    const owner = await signedIn("ctx-tax-owner@example.com")
    const shared = await owner.createOrg("Shared Tax Org")
    const member = await signedIn("ctx-tax-member@example.com")
    const own = await member.createOrg("Own Tax Org")
    await addStaff(shared.id, owner.userId, member.userId)

    const setTaxId = (orgId: string, userId: string, taxId: string) =>
      withContext(db, { orgId, userId }, (tx) =>
        tx
          .update(schema.organizations)
          .set({ taxId })
          .where(eq(schema.organizations.id, orgId))
      )
    await setTaxId(own.id, member.userId, "1111111111111")
    await setTaxId(shared.id, owner.userId, "2222222222222")

    for (const [org, taxId] of [
      [shared, "2222222222222"],
      [own, "1111111111111"],
      [shared, "2222222222222"],
    ] as const) {
      await member.request("/organizations/active", { json: { orgId: org.id } })
      expect(
        await (await member.request("/organization")).json()
      ).toMatchObject({ id: org.id, taxId })
    }
  })

  test("a member removed after the check cannot use orgTx", async () => {
    const owner = await signedIn("ctx-race-owner@example.com")
    const shared = await owner.createOrg("Race Org")
    const member = await signedIn("ctx-race-member@example.com")
    await addStaff(shared.id, owner.userId, member.userId)
    await member.request("/organizations/active", {
      json: { orgId: shared.id },
    })

    const res = await member.request("/probe/removed-mid-request", {
      json: { ownerId: owner.userId },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      message: "Not a member of this organization",
    })
  })

  test("settings missing newer keys fall back to defaults", async () => {
    const { request, createOrg, userId } = await signedIn(
      "ctx-settings@example.com"
    )
    const org = await createOrg("Old Settings Org")
    await withContext(db, { orgId: org.id, userId }, (tx) =>
      tx
        .update(schema.organizations)
        .set({ settings: { graceDays: 3 } as never })
        .where(eq(schema.organizations.id, org.id))
    )

    const res = await request("/organization")
    expect(res.status).toBe(200)
    expect(((await res.json()) as { settings: unknown }).settings).toEqual({
      graceDays: 3,
      lateFeePerDay: 0,
      lateFeeCap: null,
      bookingExpiryDays: 7,
      bookingForfeitOnCancel: true,
    })
  })
})
