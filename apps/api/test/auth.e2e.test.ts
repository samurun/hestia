import { afterAll, beforeAll, describe, expect, test } from "bun:test"

import { createClient } from "./http"

// Runs the real server process over HTTP, the way the web app talks to it.
const PORT = 3999
const BASE = `http://localhost:${PORT}`
let server: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  server = Bun.spawn(["bun", "src/index.ts"], {
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, API_PORT: String(PORT) },
    stdout: "ignore",
    stderr: "inherit",
  })
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(`${BASE}/health`)
      .then((r) => r.ok)
      .catch(() => false)
    if (ok) return
    await Bun.sleep(100)
  }
  throw new Error("API did not start")
})

afterAll(() => {
  server.kill()
})

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
