import { describe, expect, test } from "bun:test"

import "../test/env"

import { envSchema } from "./env"

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5433/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
}

describe("envSchema", () => {
  test("applies defaults", () => {
    const env = envSchema.parse(base)
    expect(env.API_PORT).toBe(3001)
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000")
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3001")
  })

  test("rejects a secret shorter than 32 characters", () => {
    expect(() =>
      envSchema.parse({ ...base, BETTER_AUTH_SECRET: "short" })
    ).toThrow()
  })

  test("requires DATABASE_URL", () => {
    expect(() =>
      envSchema.parse({ BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET })
    ).toThrow()
  })
})
