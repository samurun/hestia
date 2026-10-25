import { describe, expect, test } from "bun:test"

import "../test/env"

import { prefixAuthPaths } from "./auth"

describe("prefixAuthPaths", () => {
  test("prefixes every path and tags each operation as Auth", () => {
    const result = prefixAuthPaths({
      "/sign-in/email": { post: { tags: ["Default"] } },
      "/get-session": { get: {} },
    })

    expect(Object.keys(result)).toEqual([
      "/api/auth/sign-in/email",
      "/api/auth/get-session",
    ])
    expect(result["/api/auth/sign-in/email"]?.post?.tags).toEqual(["Auth"])
    expect(result["/api/auth/get-session"]?.get?.tags).toEqual(["Auth"])
  })

  test("supports a custom prefix", () => {
    expect(Object.keys(prefixAuthPaths({ "/ok": { get: {} } }, "/x"))).toEqual([
      "/x/ok",
    ])
  })
})
