import { describe, expect, test } from "bun:test"

import { eq, schema } from "@workspace/db"

import { createClient } from "../test/http"

import { app } from "./app"
import { db } from "./db"

// Request validation comes from @workspace/shared (zod); these check the API
// enforces it everywhere, with Thai messages, and still documents it.

const client = () => createClient("http://localhost", (req) => app.handle(req))
const password = "correct-horse-battery"

async function signedIn(email: string) {
  const request = client()
  const res = await request("/api/auth/sign-up/email", {
    json: { name: "Validator", email, password },
  })
  expect(res.status).toBe(200)
  return request
}

describe("shared request schemas", () => {
  test("a blank org name returns 422 with the schema's Thai message", async () => {
    const request = await signedIn("validation-blank@example.com")
    const res = await request("/organizations", { json: { name: "   " } })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      type: "validation",
      on: "body",
      property: "name",
      message: "กรุณากรอกชื่อกิจการ",
    })
  })

  test("org names reach the handler trimmed by the schema", async () => {
    const request = await signedIn("validation-trim@example.com")
    const res = await request("/organizations", { json: { name: "  Acme  " } })
    expect(res.status).toBe(201)
    expect(((await res.json()) as { name: string }).name).toBe("Acme")
  })

  test("sign-up enforces the shared name, email and password rules", async () => {
    for (const [body, field] of [
      [{ name: "   ", email: "v1@example.com", password }, "name"],
      [{ name: "x".repeat(101), email: "v2@example.com", password }, "name"],
      [{ name: "Ok", email: "not-an-email", password }, "email"],
      [
        { name: "Ok", email: "v3@example.com", password: "1234567" },
        "password",
      ],
    ] as const) {
      const res = await client()("/api/auth/sign-up/email", { json: body })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({
        code: "VALIDATION_ERROR",
        field,
      })
    }
  })

  test("sign-up stores the trimmed name", async () => {
    const res = await client()("/api/auth/sign-up/email", {
      json: { name: "  สมชาย  ", email: "v-trim@example.com", password },
    })
    expect(res.status).toBe(200)
    const [user] = await db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.email, "v-trim@example.com"))
    expect(user?.name).toBe("สมชาย")
  })

  test("audit query errors use the documented validation shape", async () => {
    const request = await signedIn("validation-audit@example.com")
    await request("/organizations", { json: { name: "Audit Org" } })

    const bad = await request(
      "/audit-logs?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z"
    )
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({
      type: "validation",
      on: "query",
      message: "from ต้องมาก่อน to",
    })

    // RFC 3339 variants the API accepted before the move to zod.
    const spaced = await request("/audit-logs?from=2026-10-01%2000:00:00z")
    expect(spaced.status).toBe(200)
  })

  test("the API docs describe requests from the zod schemas", async () => {
    const doc = (await (
      await app.handle(new Request("http://localhost/swagger/json"))
    ).json()) as {
      paths: Record<string, Record<string, Record<string, unknown>>>
    }
    const createOrg =
      doc.paths["/organizations/"]?.post ?? doc.paths["/organizations"]?.post
    expect(JSON.stringify(createOrg)).toContain('"maxLength":200')

    const auditLogs =
      doc.paths["/audit-logs/"]?.get ?? doc.paths["/audit-logs"]?.get
    expect(JSON.stringify(auditLogs)).toContain("cursor")
  })
})
