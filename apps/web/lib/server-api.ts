import "server-only"

import { treaty, type Treaty } from "@elysiajs/eden"
import type { App } from "api"
import { cookies } from "next/headers"

const apiUrl = process.env.API_URL ?? "http://localhost:3001"

/** Typed API client for Server Components, acting as the signed-in user. */
export async function serverApi(): Promise<Treaty.Create<App>> {
  const cookie = (await cookies()).toString()
  return treaty<App>(apiUrl, { headers: { cookie } })
}
