import { describe, expect, test } from "bun:test"

import { eq, schema, withContext } from "@workspace/db"
import { asSchemaOwner } from "@workspace/db/testing"

import { createClient } from "../test/http"
import { orgWithTeam, signUp } from "../test/org-fixture"

import { app } from "./app"
import { db } from "./db"

const handle = (req: Request) => app.handle(req)
const setup = (prefix: string) =>
  orgWithTeam("http://localhost", prefix, handle)

type Client = ReturnType<typeof createClient>
type Created = {
  invitation: { id: string; email: string; role: string; status: string }
  url: string
}

async function invite(
  request: Client,
  email: string,
  role = "staff",
  propertyIds: string[] = []
) {
  const res = await request("/invitations", {
    json: { email, role, propertyIds },
  })
  expect(res.status).toBe(201)
  const created = (await res.json()) as Created
  return { ...created, token: created.url.split("/invite/")[1]! }
}

const accept = (request: Client, token: string) =>
  request("/invitations/accept", { json: { token } })

describe("invitations", () => {
  test("only owners can invite, list or revoke", async () => {
    const { manager, staff } = await setup("inv-perm")
    for (const who of [manager, staff]) {
      const res = await who.request("/invitations", {
        json: { email: "x@example.com", role: "staff" },
      })
      expect(res.status).toBe(403)
      expect((await who.request("/invitations")).status).toBe(403)
      expect((await who.request("/memberships")).status).toBe(403)
    }
  })

  test("an invitee who signs up with the invited email joins with the role and properties", async () => {
    const { owner, org, properties, asOwner } = await setup("inv-join")
    const { token, invitation } = await invite(
      owner.request,
      "New.Staff@Example.com",
      "staff",
      [properties.x]
    )
    expect(invitation).toMatchObject({
      email: "new.staff@example.com",
      status: "pending",
    })

    const preview = await createClient(
      "http://localhost",
      handle
    )(`/invitations/preview/${token}`)
    expect(await preview.json()).toEqual({
      orgName: "inv-join Org",
      email: "new.staff@example.com",
      role: "staff",
      status: "pending",
    })

    const invitee = await signUp(
      "http://localhost",
      "new.staff@example.com",
      handle
    )
    const res = await accept(invitee.request, token)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: org.id,
      name: "inv-join Org",
      role: "staff",
    })

    const me = (await (await invitee.request("/me")).json()) as {
      activeOrg: { id: string }
    }
    expect(me.activeOrg.id).toBe(org.id)

    const members = (await (await owner.request("/memberships")).json()) as {
      user: { email: string }
      role: string
      propertyIds: string[]
    }[]
    expect(
      members.find((m) => m.user.email === "new.staff@example.com")
    ).toMatchObject({ role: "staff", propertyIds: [properties.x] })

    const list = (await (await owner.request("/invitations")).json()) as {
      status: string
    }[]
    expect(list[0]?.status).toBe("accepted")

    // The join is audited in the same transaction, with what was granted.
    const joined = members.find((m) => m.user.email === "new.staff@example.com")
    const audit = await withContext(db, asOwner, (tx) =>
      tx
        .select({
          entityId: schema.auditLogs.entityId,
          after: schema.auditLogs.after,
          ip: schema.auditLogs.ip,
        })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.action, "invitation.accept"))
    )
    expect(audit).toEqual([
      {
        entityId: (joined as unknown as { id: string }).id,
        after: {
          invitationId: invitation.id,
          role: "staff",
          propertyIds: [properties.x],
        },
        ip: null,
      },
    ])
  })

  test("the signed-in email must match the invitation", async () => {
    const { owner } = await setup("inv-mismatch")
    const { token } = await invite(owner.request, "intended@example.com")
    const other = await signUp(
      "http://localhost",
      "someone-else@example.com",
      handle
    )

    const res = await accept(other.request, token)
    expect(res.status).toBe(403)
    expect(((await res.json()) as { message: string }).message).toContain(
      "อีเมลอื่น"
    )
  })

  test("used, revoked, expired and unknown links are rejected", async () => {
    const { owner } = await setup("inv-states")

    const used = await invite(owner.request, "used@example.com")
    const usedBy = await signUp("http://localhost", "used@example.com", handle)
    expect((await accept(usedBy.request, used.token)).status).toBe(200)
    expect((await accept(usedBy.request, used.token)).status).toBe(409)

    const revoked = await invite(owner.request, "revoked@example.com")
    const revokeRes = await owner.request(
      `/invitations/${revoked.invitation.id}`,
      { method: "DELETE" }
    )
    expect(revokeRes.status).toBe(200)
    const revokedUser = await signUp(
      "http://localhost",
      "revoked@example.com",
      handle
    )
    expect((await accept(revokedUser.request, revoked.token)).status).toBe(410)

    const expired = await invite(owner.request, "expired@example.com")
    await asSchemaOwner(process.env.TEST_DATABASE_MIGRATE_URL!, (sql) =>
      sql`update invitations set expires_at = now() - interval '1 minute' where id = ${expired.invitation.id}`.then(
        () => undefined
      )
    )
    const expiredUser = await signUp(
      "http://localhost",
      "expired@example.com",
      handle
    )
    expect((await accept(expiredUser.request, expired.token)).status).toBe(410)

    const unknown = "A".repeat(43)
    expect((await accept(expiredUser.request, unknown)).status).toBe(404)
    expect(
      (
        await createClient(
          "http://localhost",
          handle
        )(`/invitations/preview/${unknown}`)
      ).status
    ).toBe(404)
  })

  test("concurrent invites for one address replace each other cleanly", async () => {
    const { owner } = await setup("inv-race")
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        owner.request("/invitations", {
          json: { email: "race@example.com", role: "staff" },
        })
      )
    )
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    const list = (await (await owner.request("/invitations")).json()) as {
      status: string
    }[]
    expect(list.filter((i) => i.status === "pending")).toHaveLength(1)
    expect(list.filter((i) => i.status === "revoked")).toHaveLength(4)
  })

  test("the preview reports a revoked invite", async () => {
    const { owner } = await setup("inv-preview")
    const { token, invitation } = await invite(owner.request, "pv@example.com")
    await owner.request(`/invitations/${invitation.id}`, { method: "DELETE" })
    const preview = await createClient(
      "http://localhost",
      handle
    )(`/invitations/preview/${token}`)
    expect(await preview.json()).toMatchObject({ status: "revoked" })
  })

  test("re-inviting replaces the open invite; members can't be invited", async () => {
    const { owner } = await setup("inv-replace")
    const first = await invite(owner.request, "again@example.com")
    const second = await invite(owner.request, "again@example.com", "manager")

    const list = (await (await owner.request("/invitations")).json()) as {
      id: string
      status: string
    }[]
    const byId = Object.fromEntries(list.map((i) => [i.id, i.status]))
    expect(byId[first.invitation.id]).toBe("revoked")
    expect(byId[second.invitation.id]).toBe("pending")

    const staffEmail = "inv-replace-staff@example.com"
    const res = await owner.request("/invitations", {
      json: { email: staffEmail.toUpperCase(), role: "staff" },
    })
    expect(res.status).toBe(409)
  })

  test("rejects other orgs' properties and bad input", async () => {
    const team = await setup("inv-invalid")
    const other = await setup("inv-invalid-other")
    const res = await team.owner.request("/invitations", {
      json: {
        email: "p@example.com",
        role: "staff",
        propertyIds: [other.properties.x],
      },
    })
    expect(res.status).toBe(422)

    for (const json of [
      { email: "nope", role: "staff" },
      { email: "a@example.com", role: "admin" },
    ]) {
      expect((await team.owner.request("/invitations", { json })).status).toBe(
        422
      )
    }
    expect(
      (
        await createClient(
          "http://localhost",
          handle
        )("/invitations/preview/short")
      ).status
    ).toBe(422)
  })

  test("accepting requires sign-in", async () => {
    const anon = createClient("http://localhost", handle)
    const res = await anon("/invitations/accept", {
      json: { token: "A".repeat(43) },
    })
    expect(res.status).toBe(401)
  })
})

describe("every org keeps an owner", () => {
  test("the last owner can't be demoted or removed", async () => {
    const { owner, asOwner } = await setup("owner-last")
    const ownerRow = eq(schema.memberships.id, owner.membershipId)

    await expect(
      withContext(db, asOwner, (tx) =>
        tx.update(schema.memberships).set({ role: "manager" }).where(ownerRow)
      )
    ).rejects.toThrow()
    await expect(
      withContext(db, asOwner, (tx) =>
        tx.delete(schema.memberships).where(ownerRow)
      )
    ).rejects.toThrow()
  })

  test("with a second owner, one can step down", async () => {
    const { owner, manager, asOwner } = await setup("owner-two")
    await withContext(db, asOwner, (tx) =>
      tx
        .update(schema.memberships)
        .set({ role: "owner" })
        .where(eq(schema.memberships.id, manager.membershipId))
    )
    const demoted = await withContext(db, asOwner, (tx) =>
      tx
        .update(schema.memberships)
        .set({ role: "manager" })
        .where(eq(schema.memberships.id, owner.membershipId))
        .returning({ role: schema.memberships.role })
    )
    expect(demoted).toEqual([{ role: "manager" }])
  })

  test("an org's only owner can't delete their account", async () => {
    const { owner } = await setup("owner-account")
    // Query builders are lazy thenables; an async wrapper runs them.
    const deleteAccount = async () => {
      await db.delete(schema.users).where(eq(schema.users.id, owner.userId))
    }
    await expect(deleteAccount()).rejects.toThrow()
  })

  test("deleting the whole org still cascades", async () => {
    const { org } = await setup("owner-cascade")
    await asSchemaOwner(process.env.TEST_DATABASE_MIGRATE_URL!, async (sql) => {
      // audit_logs is append-only and has no cascade; clear it the
      // maintenance way first, like a real org purge would.
      await sql.unsafe(
        `set session_replication_role = replica; delete from audit_logs where org_id = '${org.id}'; set session_replication_role = default;`
      )
      await sql`delete from organizations where id = ${org.id}`
      const [left] =
        await sql`select count(*)::int as n from memberships where org_id = ${org.id}`
      expect(left?.n).toBe(0)
    })
  })
})
