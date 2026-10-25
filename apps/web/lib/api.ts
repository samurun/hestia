import { treaty, type Treaty } from "@elysiajs/eden"
import type { App } from "api"

export const api: Treaty.Create<App> = treaty<App>(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
)
