import { isIP } from "node:net"

/**
 * The caller's IP for the audit log, or null.
 *
 * `trustedHops` is how many reverse proxies sit in front of the API. Each
 * proxy appends the address it received from, so the real client is the
 * entry `trustedHops` from the right; anything further left was sent by the
 * client and can be forged. With 0 the header is ignored.
 */
export function clientIp({
  forwardedFor,
  socketIp,
  trustedHops,
}: {
  forwardedFor: string | null
  socketIp: string | null
  trustedHops: number
}): string | null {
  let candidate = socketIp
  if (trustedHops > 0 && forwardedFor) {
    const hops = forwardedFor.split(",").map((hop) => hop.trim())
    if (hops.length >= trustedHops) candidate = hops[hops.length - trustedHops]!
  }
  return candidate && isIP(candidate) ? candidate : null
}
