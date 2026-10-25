import { describe, expect, test } from "bun:test"

import { loadLoginSearchParams } from "./search-params"

describe("loadLoginSearchParams", () => {
  test("reads next and defaults to /", () => {
    expect(loadLoginSearchParams("https://x/login?next=%2Fonboarding")).toEqual(
      { next: "/onboarding" }
    )
    expect(loadLoginSearchParams("https://x/login")).toEqual({ next: "/" })
  })
})
