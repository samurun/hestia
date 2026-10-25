import { describe, expect, test } from "bun:test"

import { and, eq, schema, withContext, withOrg } from "@workspace/db"

import { createClient } from "../test/http"

import { app } from "./app"
import { db } from "./db"

type Org = { id: string; name: string; role: string }
type Me = { user: { id: string }; activeOrg: Org | null }

const password = "correct-horse-battery"

async function signedIn(email: string) {
  const request = createClient("http://localhost", (req) => app.handle(req))
  await request("/api/auth/sign-up/email", {
    json: { name: "Tester", email, password },
  })
  const createOrg = async (name: string) => {
    const res = await request("/organizations", { json: { name } })
    expect(res.status).toBe(201)
    return (await res.json()) as Org
  }
  const me = async () => (await (await request("/me")).json()) as Me
  const userId = (await me()).user.id
  return { request, createOrg, me, userId, email }
}

/** A fresh session for an existing user, like signing in on another device. */
async function signIn(email: string) {
  const request = createClient("http://localhost", (req) => app.handle(req))
  const res = await request("/api/auth/sign-in/email", {
    json: { email, password },
  })
  expect(res.status).toBe(200)
  return async () => (await (await request("/me")).json()) as Me
}

/** Adds a member the way an owner would (invites arrive in #7). */
function addMember(orgId: string, ownerId: string, userId: string) {
  return withContext(db, { orgId, userId: ownerId }, (tx) =>
    tx.insert(schema.memberships).values({ orgId, userId, role: "staff" })
  )
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

  test("orgs with the same name are listed in a stable order", async () => {
    const { request, createOrg } = await signedIn("samename@example.com")
    const ids = [
      (await createOrg("บ้านเช่า")).id,
      (await createOrg("บ้านเช่า")).id,
      (await createOrg("บ้านเช่า")).id,
    ].sort()
    for (let i = 0; i < 3; i++) {
      const list = (await (await request("/organizations")).json()) as Org[]
      expect(list.map((o) => o.id)).toEqual(ids)
    }
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
    const b = await signedIn("rls-b@example.com")

    const seen = await withContext(db, { userId: b.userId }, async (tx) => ({
      orgs: await tx.select().from(schema.organizations),
      memberships: await tx.select().from(schema.memberships),
    }))
    expect(seen).toEqual({ orgs: [], memberships: [] })
  })

  test("removing a member clears their active and last-used org", async () => {
    const owner = await signedIn("remove-owner@example.com")
    const org = await owner.createOrg("Shared Org")
    const member = await signedIn("remove-member@example.com")
    await addMember(org.id, owner.userId, member.userId)
    await member.request("/organizations/active", { json: { orgId: org.id } })
    expect((await member.me()).activeOrg?.id).toBe(org.id)

    await withContext(db, { orgId: org.id, userId: owner.userId }, (tx) =>
      tx
        .delete(schema.memberships)
        .where(eq(schema.memberships.userId, member.userId))
    )

    const [session] = await db
      .select({ activeOrgId: schema.sessions.activeOrgId })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, member.userId))
    const [user] = await db
      .select({ lastActiveOrgId: schema.users.lastActiveOrgId })
      .from(schema.users)
      .where(eq(schema.users.id, member.userId))
    expect(session?.activeOrgId).toBeNull()
    expect(user?.lastActiveOrgId).toBeNull()
    expect((await member.me()).activeOrg).toBeNull()
  })

  test("only owners can add, change or remove members (RLS)", async () => {
    const owner = await signedIn("guard-owner@example.com")
    const org = await owner.createOrg("Guarded Org")
    const staff = await signedIn("guard-staff@example.com")
    const outsider = await signedIn("guard-outsider@example.com")
    await addMember(org.id, owner.userId, staff.userId)

    const asStaff = { orgId: org.id, userId: staff.userId }
    const staffRow = and(
      eq(schema.memberships.orgId, org.id),
      eq(schema.memberships.userId, staff.userId)
    )

    // Staff cannot add anyone, including themselves as owner.
    await expect(
      withContext(db, asStaff, (tx) =>
        tx.insert(schema.memberships).values({
          orgId: org.id,
          userId: outsider.userId,
          role: "owner",
        })
      )
    ).rejects.toThrow()

    // Staff cannot promote themselves; RLS silently matches no rows.
    const promoted = await withContext(db, asStaff, (tx) =>
      tx
        .update(schema.memberships)
        .set({ role: "owner" })
        .where(staffRow)
        .returning()
    )
    expect(promoted).toEqual([])

    // An outsider cannot join an org that already has members.
    await expect(
      withContext(db, { orgId: org.id, userId: outsider.userId }, (tx) =>
        tx.insert(schema.memberships).values({
          orgId: org.id,
          userId: outsider.userId,
          role: "owner",
        })
      )
    ).rejects.toThrow()

    // The owner can change roles.
    const changed = await withContext(
      db,
      { orgId: org.id, userId: owner.userId },
      (tx) =>
        tx
          .update(schema.memberships)
          .set({ role: "manager" })
          .where(staffRow)
          .returning()
    )
    expect(changed[0]?.role).toBe("manager")
  })

  test("signing in again restores the last-used org", async () => {
    const { createOrg, email } = await signedIn("restore@example.com")
    await createOrg("First")
    await createOrg("Second")
    expect((await (await signIn(email))()).activeOrg?.name).toBe("Second")

    const user = await signedIn("restore-switch@example.com")
    const kept = await user.createOrg("Kept")
    await user.createOrg("Other")
    await user.request("/organizations/active", { json: { orgId: kept.id } })
    expect((await (await signIn(user.email))()).activeOrg?.id).toBe(kept.id)
  })

  test("trims names before validating the 200-character limit", async () => {
    const { request } = await signedIn("validate@example.com")
    const fits = `  ${"ก".repeat(200)}  `
    const res = await request("/organizations", { json: { name: fits } })
    expect(res.status).toBe(201)
    expect(((await res.json()) as Org).name).toBe("ก".repeat(200))

    for (const name of ["   ", "ก".repeat(201)]) {
      const rejected = await request("/organizations", { json: { name } })
      expect(rejected.status).toBe(422)
    }
  })

  test("the database rejects untrimmed or over-long names", async () => {
    for (const name of [" padded ", "x".repeat(201)]) {
      const orgId = crypto.randomUUID()
      await expect(
        withOrg(db, orgId, (tx) =>
          tx.insert(schema.organizations).values({ id: orgId, name })
        )
      ).rejects.toThrow()
    }
  })

  test("rejects unauthenticated requests", async () => {
    const anon = createClient("http://localhost", (req) => app.handle(req))
    expect((await anon("/organizations")).status).toBe(401)
    expect((await anon("/organizations", { json: { name: "X" } })).status).toBe(
      401
    )
  })
})
