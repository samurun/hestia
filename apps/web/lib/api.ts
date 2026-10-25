import { treaty, type Treaty } from "@elysiajs/eden"
import type { App } from "api"

/**
 * Typed API client for Client Components. Goes through this app's /api
 * rewrite, so the browser sends the session cookie as a first-party cookie.
 */
export function browserApi(): Treaty.Create<App> {
  return treaty<App>(`${window.location.origin}/api`)
}
