import { schema } from "@workspace/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { openAPI } from "better-auth/plugins"

import { db } from "./db"
import { env } from "./env"
import { defaultActiveOrgId } from "./memberships"
import { prefixAuthPaths, type OpenAPIPaths } from "./openapi"

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
  session: {
    additionalFields: {
      // Set only by POST /organizations and /organizations/active.
      activeOrgId: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Sign-in restores the last-used org instead of starting empty.
        before: async (session) => ({
          data: {
            ...session,
            activeOrgId: await defaultActiveOrgId(session.userId),
          },
        }),
      },
    },
  },
  plugins: [openAPI()],
})

export async function authOpenAPI() {
  const { paths, components } = await auth.api.generateOpenAPISchema()
  return {
    paths: prefixAuthPaths(paths as OpenAPIPaths),
    components,
  }
}
