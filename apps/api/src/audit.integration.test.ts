import { describe, expect, test } from "bun:test"

import { eq, schema, withContext } from "@workspace/db"
import { asSchemaOwner } from "@workspace/db/testing"
import { Elysia, t } from "elysia"

import { createClient } from "../test/http"
import { orgWithTeam } from "../test/org-fixture"

import { app } from "./app"
import { db } from "./db"
import { orgPlugin } from "./plugins/org"

type AuditPage = {
  items: {
    id: string
    action: string
    entity: string
    entityId: string | null
    actor: { email: string } | null
    after: unknown
  }[]
  nextCursor: string | null
}

const probe = new Elysia().use(orgPlugin).post(
  "/probe/audit",
  ({ orgTx, audit, body }) =>
    orgTx(async (tx) => {
      await audit(tx, {
        action: "probe.write",
        entity: "probe",
        after: { n: body.n },
      })
      if (body.fail) throw new Error("change failed after logging")
      return "ok"
    }),
  { org: true, body: t.Object({ n: t.Number(), fail: t.Boolean() }) }
)

const handle = (req: Request) =>
  new URL(req.url).pathname.startsWith("/probe")
    ? probe.handle(req)
    : app.handle(req)

const setup = (prefix: string) =>
  orgWithTeam("http://localhost", prefix, handle)

type Client = ReturnType<typeof createClient>

const logs = async (request: Client, query = "") =>
  (await (await request(`/audit-logs${query}`)).json()) as AuditPage

const write = (request: Client, n: number, fail = false) =>
  request("/probe/audit", { json: { n, fail } })

describe("audit log", () => {
  test("a rolled-back change leaves no log", async () => {
    const { owner } = await setup("audit-rollback")
    expect((await write(owner.request, 1, true)).status).toBe(500)
    expect((await write(owner.request, 2)).status).toBe(200)

    const page = await logs(owner.request, "?action=probe.write")
    expect(page.items.map((item) => item.after)).toEqual([{ n: 2 }])
  })

  test("only owners can read the log", async () => {
    const { owner, manager, staff } = await setup("audit-who")
    expect((await owner.request("/audit-logs")).status).toBe(200)
    expect((await manager.request("/audit-logs")).status).toBe(403)
    expect((await staff.request("/audit-logs")).status).toBe(403)
    const anon = createClient("http://localhost", handle)
    expect((await anon("/audit-logs")).status).toBe(401)
  })

  test("existing changes are logged with their actor", async () => {
    const { org, owner, staff, properties } = await setup("audit-existing")
    await owner.request(`/memberships/${staff.membershipId}/properties`, {
      method: "PUT",
      json: { propertyIds: [properties.x] },
    })

    const page = await logs(owner.request)
    const byAction = Object.fromEntries(
      page.items.map((item) => [item.action, item])
    )
    expect(byAction["organization.create"]).toMatchObject({
      entity: "organization",
      entityId: org.id,
      actor: { email: "audit-existing-owner@example.com" },
    })
    expect(byAction["membership.properties.set"]).toMatchObject({
      entityId: staff.membershipId,
      after: { propertyIds: [properties.x] },
    })
  })

  test("filters by action, entity and entity id", async () => {
    const { org, owner } = await setup("audit-filter")
    await write(owner.request, 1)

    const byAction = await logs(owner.request, "?action=probe.write")
    expect(byAction.items.map((i) => i.action)).toEqual(["probe.write"])

    const byEntity = await logs(owner.request, "?entity=organization")
    expect(byEntity.items.map((i) => i.action)).toEqual(["organization.create"])

    const byId = await logs(owner.request, `?entityId=${org.id}`)
    expect(byId.items).toHaveLength(1)
  })

  test("pages newest first without gaps or duplicates", async () => {
    const { owner } = await setup("audit-paging")
    for (let n = 1; n <= 5; n++) await write(owner.request, n)

    const seen: unknown[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page: AuditPage = await logs(
        owner.request,
        `?action=probe.write&limit=2${cursor ? `&cursor=${cursor}` : ""}`
      )
      seen.push(...page.items.map((item) => item.after))
      cursor = page.nextCursor
      pages++
    } while (cursor)

    expect(pages).toBe(3)
    expect(seen).toEqual([{ n: 5 }, { n: 4 }, { n: 3 }, { n: 2 }, { n: 1 }])
  })

  test("owners only see their own org's log", async () => {
    const a = await setup("audit-iso-a")
    const b = await setup("audit-iso-b")
    await write(b.owner.request, 1)

    const page = await logs(a.owner.request)
    expect(page.items.map((i) => i.action)).toEqual(["organization.create"])
    expect(page.items[0]?.entityId).toBe(a.org.id)
  })

  test("the app role cannot update or delete log rows", async () => {
    const { asOwner } = await setup("audit-append-only")
    await expect(
      withContext(db, asOwner, (tx) =>
        tx.update(schema.auditLogs).set({ action: "tampered.update" })
      )
    ).rejects.toThrow()
    await expect(
      withContext(db, asOwner, (tx) =>
        tx
          .delete(schema.auditLogs)
          .where(eq(schema.auditLogs.orgId, asOwner.orgId))
      )
    ).rejects.toThrow()
  })

  test("rejects bad paging parameters", async () => {
    const { owner } = await setup("audit-params")
    for (const query of [
      "?limit=0",
      "?limit=101",
      "?cursor=nope",
      "?action=",
      "?entity=",
      "?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z",
      "?from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00Z",
    ]) {
      expect((await owner.request(`/audit-logs${query}`)).status).toBe(422)
    }
  })

  test("append-only holds even for the table owner", async () => {
    const { asOwner } = await setup("audit-owner-guard")
    await asSchemaOwner(process.env.TEST_DATABASE_MIGRATE_URL!, async (sql) => {
      for (const statement of [
        `update audit_logs set action = 'tampered.update' where org_id = '${asOwner.orgId}'`,
        `delete from audit_logs where org_id = '${asOwner.orgId}'`,
        "truncate audit_logs",
      ]) {
        // postgres.js queries are lazy thenables; an async wrapper runs them.
        const run = async () => {
          await sql.unsafe(statement)
        }
        await expect(run()).rejects.toThrow(/append-only/)
      }
    })
  })

  test("ids follow commit order, so a slow writer can't land behind a cursor", async () => {
    const { asOwner } = await setup("audit-order")
    const committed: string[] = []
    const log = (name: string) => ({
      orgId: asOwner.orgId,
      actorId: asOwner.userId,
      action: "order.test",
      entity: "order",
      after: { name },
    })

    // "slow" logs first, then keeps its transaction open; "fast" logs after
    // and would normally commit first with a newer id.
    const slow = withContext(db, asOwner, async (tx) => {
      await tx.insert(schema.auditLogs).values(log("slow"))
      await Bun.sleep(300)
    }).then(() => committed.push("slow"))
    await Bun.sleep(50)
    const fast = withContext(db, asOwner, (tx) =>
      tx.insert(schema.auditLogs).values(log("fast"))
    ).then(() => committed.push("fast"))
    await Promise.all([slow, fast])

    const rows = await withContext(db, asOwner, (tx) =>
      tx
        .select({ id: schema.auditLogs.id, after: schema.auditLogs.after })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.action, "order.test"))
        .orderBy(schema.auditLogs.id)
    )
    expect(rows.map((row) => (row.after as { name: string }).name)).toEqual(
      committed
    )
  })
})
