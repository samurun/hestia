import { describe, expect, test } from "bun:test"

import { NextRequest } from "next/server"

import { config, proxy } from "./proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  })

const session = "better-auth.session_token=abc.def"

describe("proxy", () => {
  test("sends visitors without a session to login, remembering the page", () => {
    const res = proxy(request("/onboarding?step=2"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fonboarding%3Fstep%3D2"
    )
  })

  test("does not add next for the home page", () => {
    expect(proxy(request("/")).headers.get("location")).toBe(
      "http://localhost:3000/login"
    )
  })

  test("lets public pages and session holders through", () => {
    for (const res of [
      proxy(request("/login")),
      proxy(request("/signup")),
      proxy(request("/", session)),
      proxy(request("/onboarding", session)),
    ]) {
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-middleware-next")).toBe("1")
    }
  })

  test("the matcher skips the API rewrite, Next internals and files", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`)
    expect(pattern.test("/")).toBe(true)
    expect(pattern.test("/onboarding")).toBe(true)
    expect(pattern.test("/api/me")).toBe(false)
    expect(pattern.test("/_next/static/chunk.js")).toBe(false)
    expect(pattern.test("/favicon.ico")).toBe(false)
  })
})
