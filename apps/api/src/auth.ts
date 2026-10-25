import { schema } from "@workspace/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { openAPI } from "better-auth/plugins"

import { db } from "./db"
import { env } from "./env"

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  // "uuid" lets Postgres fill ids from the uuidv7() column default.
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: { enabled: true },
  plugins: [openAPI()],
})

type OpenAPIPaths = Record<string, Record<string, { tags?: string[] }>>

/** Better Auth paths are relative to its basePath; tag them for Scalar. */
export function prefixAuthPaths(paths: OpenAPIPaths, prefix = "/api/auth") {
  const result: OpenAPIPaths = {}
  for (const [path, operations] of Object.entries(paths)) {
    result[prefix + path] = Object.fromEntries(
      Object.entries(operations).map(([method, op]) => [
        method,
        { ...op, tags: ["Auth"] },
      ])
    )
  }
  return result
}

export async function authOpenAPI() {
  const { paths, components } = await auth.api.generateOpenAPISchema()
  return {
    paths: prefixAuthPaths(paths as OpenAPIPaths),
    components,
  }
}
