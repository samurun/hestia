import { describe, expect, test } from "bun:test"

import { eq, schema, withOrg } from "@workspace/db"

import { createClient } from "../test/http"

import { app } from "./app"
import { db } from "./db"

const client = () => createClient("http://localhost", (req) => app.handle(req))

const signUp = (request: ReturnType<typeof client>, email: string) =>
  request("/api/auth/sign-up/email", {
    json: { name: "Somchai", email, password: "correct-horse-battery" },
  })

describe("auth", () => {
  test("sign up creates a user with a uuidv7 id and a hashed password", async () => {
    const request = client()
    const res = await signUp(request, "signup@example.com")
    expect(res.status).toBe(200)

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "signup@example.com"))
    expect(user?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)

    const [account] = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, user!.id))
    expect(account?.providerId).toBe("credential")
    expect(account?.password).not.toContain("correct-horse-battery")
  })

  test("signing up twice with the same email fails", async () => {
    await signUp(client(), "dupe@example.com")
    const res = await signUp(client(), "dupe@example.com")
    expect(res.status).toBe(422)
  })

  test("/me returns the signed-in user and 401 without a session", async () => {
    const request = client()
    expect((await request("/me")).status).toBe(401)

    await signUp(request, "me@example.com")
    const res = await request("/me")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { email: string } }
    expect(body.user.email).toBe("me@example.com")
  })

  test("sign in rejects a wrong password", async () => {
    await signUp(client(), "wrongpw@example.com")
    const res = await client()("/api/auth/sign-in/email", {
      json: { email: "wrongpw@example.com", password: "not-the-password" },
    })
    expect(res.status).toBe(401)
  })

  test("sign out ends the session", async () => {
    const request = client()
    await signUp(request, "signout@example.com")
    expect((await request("/me")).status).toBe(200)

    const res = await request("/api/auth/sign-out", { json: {} })
    expect(res.status).toBe(200)
    expect((await request("/me")).status).toBe(401)
  })

  test("audit log keeps the row but clears actor when the user is deleted", async () => {
    await signUp(client(), "actor@example.com")
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "actor@example.com"))
    const orgId = crypto.randomUUID()

    await withOrg(db, orgId, async (tx) => {
      await tx.insert(schema.organizations).values({ id: orgId, name: "Org" })
      await tx.insert(schema.auditLogs).values({
        orgId,
        actorId: user!.id,
        action: "create",
        entity: "organization",
      })
    })
    await db.delete(schema.users).where(eq(schema.users.id, user!.id))

    const rows = await withOrg(db, orgId, (tx) =>
      tx.select().from(schema.auditLogs)
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorId).toBeNull()
  })

  test("auth endpoints are listed in the API docs", async () => {
    const res = await app.handle(new Request("http://localhost/swagger/json"))
    const doc = (await res.json()) as { paths: Record<string, unknown> }
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        "/api/auth/sign-up/email",
        "/api/auth/sign-in/email",
        "/api/auth/sign-out",
        "/me",
      ])
    )
  })
})
