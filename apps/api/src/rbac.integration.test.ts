import { describe, expect, test } from "bun:test"

import { eq, schema, withContext } from "@workspace/db"
import { Elysia, t } from "elysia"

import { createClient } from "../test/http"
import { orgWithTeam, signUp } from "../test/org-fixture"

import { app } from "./app"
import { db } from "./db"
import { rbacPlugin } from "./plugins/rbac"

const probe = new Elysia()
  .use(rbacPlugin)
  .get("/probe/audit", () => "ok", { org: true, permission: "audit.read" })
  .get("/probe/properties-manage", () => "ok", {
    org: true,
    permission: "properties.manage",
  })
  .get("/probe/meters", () => "ok", { org: true, permission: "meters.record" })
  .get(
    "/probe/properties",
    async ({ orgTx }) =>
      (
        await orgTx((tx) =>
          tx
            .select({ id: schema.properties.id })
            .from(schema.properties)
            .orderBy(schema.properties.name)
        )
      ).map((row) => row.id),
    { org: true }
  )
  .get(
    "/probe/properties/:id",
    ({ orgTx, params }) =>
      orgTx((tx) =>
        tx
          .select({ id: schema.properties.id })
          .from(schema.properties)
          .where(eq(schema.properties.id, params.id))
      ),
    { org: true, params: t.Object({ id: t.String() }) }
  )

// Permission without an explicit org: true, relying on the macro expansion.
const bare = new Elysia()
  .use(rbacPlugin)
  .get("/probe/bare-audit", () => "ok", { permission: "audit.read" })

// Demotes the caller (through a second owner) after the permission check,
// then uses orgTx.
const demote = new Elysia().use(rbacPlugin).post(
  "/probe/demoted-mid-request",
  async ({ org, user, orgTx, body }) => {
    await withContext(db, { orgId: org.id, userId: body.byOwnerId }, (tx) =>
      tx
        .update(schema.memberships)
        .set({ role: "staff" })
        .where(eq(schema.memberships.userId, user.id))
    )
    return orgTx(async () => "still allowed")
  },
  {
    org: true,
    permission: "members.manage",
    body: t.Object({ byOwnerId: t.String() }),
  }
)

const handle = (req: Request) => {
  const path = new URL(req.url).pathname
  if (path === "/probe/bare-audit") return bare.handle(req)
  if (path === "/probe/demoted-mid-request") return demote.handle(req)
  return path.startsWith("/probe") ? probe.handle(req) : app.handle(req)
}

const setup = (prefix: string) =>
  orgWithTeam("http://localhost", prefix, handle)

type Client = Awaited<ReturnType<typeof setup>>["owner"]["request"]

const assign = (request: Client, membershipId: string, propertyIds: string[]) =>
  request(`/memberships/${membershipId}/properties`, {
    method: "PUT",
    json: { propertyIds },
  })

const visible = async (request: Client) =>
  (await (await request("/probe/properties")).json()) as string[]

describe("rbac", () => {
  test("the permission option follows the role table", async () => {
    const { owner, manager, staff } = await setup("rbac-perm")
    const statuses = async (path: string) =>
      Promise.all(
        [owner, manager, staff].map(
          async (who) => (await who.request(path)).status
        )
      )

    expect(await statuses("/probe/audit")).toEqual([200, 403, 403])
    expect(await statuses("/probe/properties-manage")).toEqual([200, 200, 403])
    expect(await statuses("/probe/meters")).toEqual([200, 200, 200])
  })

  test("managers and staff only see properties assigned to them", async () => {
    const { owner, manager, staff, properties } = await setup("rbac-scope")
    const both = [properties.x, properties.y].sort()

    expect((await visible(owner.request)).sort()).toEqual(both)
    expect(await visible(manager.request)).toEqual([])
    expect(await visible(staff.request)).toEqual([])

    expect(
      (await assign(owner.request, staff.membershipId, [properties.x])).status
    ).toBe(200)
    expect(
      (await assign(owner.request, manager.membershipId, [properties.y])).status
    ).toBe(200)

    expect(await visible(staff.request)).toEqual([properties.x])
    expect(await visible(manager.request)).toEqual([properties.y])
    const byId = await staff.request(`/probe/properties/${properties.y}`)
    expect(await byId.json()).toEqual([])
  })

  test("assignments are replaced, deduplicated and audited", async () => {
    const { owner, staff, properties, asOwner } = await setup("rbac-replace")
    await assign(owner.request, staff.membershipId, [
      properties.x,
      properties.y,
    ])
    const res = await assign(owner.request, staff.membershipId, [
      properties.y,
      properties.y,
    ])
    expect(await res.json()).toEqual({
      membershipId: staff.membershipId,
      propertyIds: [properties.y],
    })
    expect(await visible(staff.request)).toEqual([properties.y])

    const audit = await withContext(db, asOwner, (tx) =>
      tx
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.action, "membership.properties.set"))
        .orderBy(schema.auditLogs.id)
    )
    expect(audit).toHaveLength(2)
    expect(audit.at(-1)?.after).toEqual({ propertyIds: [properties.y] })
  })

  test("only owners can assign properties", async () => {
    const { manager, staff, properties } = await setup("rbac-who")
    for (const who of [manager, staff]) {
      const res = await assign(who.request, staff.membershipId, [properties.x])
      expect(res.status).toBe(403)
    }
  })

  test("rejects unknown members, owners and other orgs' properties", async () => {
    const team = await setup("rbac-invalid")
    const other = await setup("rbac-invalid-other")
    const { owner, staff } = team

    expect((await assign(owner.request, crypto.randomUUID(), [])).status).toBe(
      404
    )
    expect(
      (await assign(owner.request, other.staff.membershipId, [])).status
    ).toBe(404)
    expect(
      (await assign(owner.request, owner.membershipId, [team.properties.x]))
        .status
    ).toBe(422)
    expect(
      (await assign(owner.request, staff.membershipId, [other.properties.x]))
        .status
    ).toBe(422)
  })

  test("the database enforces the same rules", async () => {
    const { org, manager, staff, properties, asOwner } = await setup("rbac-db")
    const asStaff = { orgId: org.id, userId: staff.userId }
    const asManager = { orgId: org.id, userId: manager.userId }

    // Staff cannot assign themselves or create properties.
    await expect(
      withContext(db, asStaff, (tx) =>
        tx.insert(schema.membershipProperties).values({
          orgId: org.id,
          membershipId: staff.membershipId,
          propertyId: properties.x,
        })
      )
    ).rejects.toThrow()
    await expect(
      withContext(db, asStaff, (tx) =>
        tx.insert(schema.properties).values({ orgId: org.id, name: "Nope" })
      )
    ).rejects.toThrow()

    // Managers can create properties but not edit ones they don't look after.
    await withContext(db, asManager, (tx) =>
      tx.insert(schema.properties).values({ orgId: org.id, name: "New" })
    )
    const edited = await withContext(db, asManager, (tx) =>
      tx
        .update(schema.properties)
        .set({ name: "Renamed" })
        .where(eq(schema.properties.id, properties.x))
        .returning()
    )
    expect(edited).toEqual([])

    // Composite FKs stop a cross-org assignment even for an owner.
    const other = await setup("rbac-db-other")
    await expect(
      withContext(db, asOwner, (tx) =>
        tx.insert(schema.membershipProperties).values({
          orgId: org.id,
          membershipId: staff.membershipId,
          propertyId: other.properties.x,
        })
      )
    ).rejects.toThrow()
  })

  test("a permission without org: true still fails closed", async () => {
    const { owner, staff } = await setup("rbac-bare")
    expect((await owner.request("/probe/bare-audit")).status).toBe(200)
    expect((await staff.request("/probe/bare-audit")).status).toBe(403)
    const anon = createClient("http://localhost", handle)
    expect((await anon("/probe/bare-audit")).status).toBe(401)
  })

  test("an owner demoted after the permission check cannot use orgTx", async () => {
    const team = await setup("rbac-demote")
    const second = await signUp(
      "http://localhost",
      "rbac-demote-second@example.com",
      handle
    )
    await withContext(db, team.asOwner, (tx) =>
      tx.insert(schema.memberships).values({
        orgId: team.org.id,
        userId: second.userId,
        role: "owner",
      })
    )
    await second.request("/organizations/active", {
      json: { orgId: team.org.id },
    })

    const res = await second.request("/probe/demoted-mid-request", {
      json: { byOwnerId: team.owner.userId },
    })
    expect(res.status).toBe(403)
  })

  test("concurrent replaces for the same member both succeed", async () => {
    const { owner, staff, properties } = await setup("rbac-race")
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        assign(owner.request, staff.membershipId, [properties.x])
      )
    )
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(await visible(staff.request)).toEqual([properties.x])
  })

  test("a manager sees and manages the properties they create", async () => {
    const { org, owner, manager, staff } = await setup("rbac-create")
    const asManager = { orgId: org.id, userId: manager.userId }

    const [created] = await withContext(db, asManager, (tx) =>
      tx
        .insert(schema.properties)
        .values({ orgId: org.id, name: "Manager Built" })
        .returning({ id: schema.properties.id })
    )
    expect(created?.id).toBeString()
    expect(await visible(manager.request)).toEqual([created!.id])
    expect(await visible(staff.request)).toEqual([])

    const renamed = await withContext(db, asManager, (tx) =>
      tx
        .update(schema.properties)
        .set({ name: "Manager Renamed" })
        .where(eq(schema.properties.id, created!.id))
        .returning({ id: schema.properties.id })
    )
    expect(renamed).toHaveLength(1)

    // The owner can take it away again.
    await assign(owner.request, manager.membershipId, [])
    expect(await visible(manager.request)).toEqual([])
  })

  test("promotion to owner clears assignments for good", async () => {
    const { staff, properties, asOwner, owner } = await setup("rbac-promote")
    await assign(owner.request, staff.membershipId, [properties.x])

    const setRole = (role: "owner" | "staff") =>
      withContext(db, asOwner, (tx) =>
        tx
          .update(schema.memberships)
          .set({ role })
          .where(eq(schema.memberships.id, staff.membershipId))
      )
    await setRole("owner")
    await setRole("staff")

    expect(await visible(staff.request)).toEqual([])
  })

  test("staff only see their own assignments", async () => {
    const { org, owner, manager, staff, properties } =
      await setup("rbac-own-assign")
    await assign(owner.request, staff.membershipId, [properties.x])
    await assign(owner.request, manager.membershipId, [properties.y])

    const seen = await withContext(
      db,
      { orgId: org.id, userId: staff.userId },
      (tx) =>
        tx
          .select({ membershipId: schema.membershipProperties.membershipId })
          .from(schema.membershipProperties)
    )
    expect(seen).toEqual([{ membershipId: staff.membershipId }])
  })
})
