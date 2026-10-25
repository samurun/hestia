import { describe, expect, test } from "bun:test"

import { createClient } from "./http"
import { useServer } from "./server"

// Runs the real server process over HTTP, the way the web app talks to it.
const BASE = useServer(3999)

describe("auth over HTTP", () => {
  test("sign up → /me → sign out → sign in", async () => {
    const request = createClient(BASE)
    const credentials = {
      email: "e2e@example.com",
      password: "correct-horse-battery",
    }

    const signUp = await request("/api/auth/sign-up/email", {
      json: { name: "E2E", ...credentials },
    })
    expect(signUp.status).toBe(200)
    expect(signUp.headers.get("access-control-allow-credentials")).toBe("true")

    const me = await request("/me")
    expect(me.status).toBe(200)
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(
      credentials.email
    )

    expect((await request("/api/auth/sign-out", { json: {} })).status).toBe(200)
    expect((await request("/me")).status).toBe(401)

    expect(
      (await request("/api/auth/sign-in/email", { json: credentials })).status
    ).toBe(200)
    expect((await request("/me")).status).toBe(200)
  })

  test("health reports the database as up", async () => {
    const res = await fetch(`${BASE}/health`)
    expect(await res.json()).toEqual({ status: "ok", db: "up" })
  })
})
