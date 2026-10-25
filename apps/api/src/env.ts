import { z } from "zod"

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3001"),
  /** Reverse proxies in front of the API; 0 ignores X-Forwarded-For. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
})

export const env = envSchema.parse(process.env)
