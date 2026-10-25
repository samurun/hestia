import { describe, expect, test } from "bun:test"

import { clientIp } from "./client-ip"

describe("clientIp", () => {
  test("ignores X-Forwarded-For unless proxies are trusted", () => {
    expect(
      clientIp({
        forwardedFor: "203.0.113.9",
        socketIp: "127.0.0.1",
        trustedHops: 0,
      })
    ).toBe("127.0.0.1")
  })

  test("takes the entry the trusted proxy appended, not a forged one", () => {
    // The client sent "1.2.3.4"; one proxy appended the real 203.0.113.9.
    expect(
      clientIp({
        forwardedFor: "1.2.3.4, 203.0.113.9",
        socketIp: "10.0.0.2",
        trustedHops: 1,
      })
    ).toBe("203.0.113.9")
  })

  test("counts hops from the right with several proxies", () => {
    expect(
      clientIp({
        forwardedFor: "1.2.3.4, 203.0.113.9, 10.0.0.5",
        socketIp: "10.0.0.2",
        trustedHops: 2,
      })
    ).toBe("203.0.113.9")
  })

  test("falls back to the socket when the header is short or missing", () => {
    expect(
      clientIp({ forwardedFor: "1.2.3.4", socketIp: "::1", trustedHops: 2 })
    ).toBe("::1")
    expect(
      clientIp({ forwardedFor: null, socketIp: "::1", trustedHops: 1 })
    ).toBe("::1")
  })

  test("returns null for anything that isn't an IP", () => {
    expect(
      clientIp({ forwardedFor: "x, evil", socketIp: null, trustedHops: 1 })
    ).toBeNull()
    expect(
      clientIp({ forwardedFor: null, socketIp: null, trustedHops: 0 })
    ).toBeNull()
  })
})
