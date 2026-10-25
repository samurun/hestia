import { schema } from "@workspace/db"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@workspace/shared"
import { signUpBody } from "@workspace/shared/schemas"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  session: {
    additionalFields: {
      // Set only by POST /organizations and /organizations/active.
      activeOrgId: { type: "string", required: false, input: false },
    },
  },
  hooks: {
    // Better Auth only checks the password; apply the shared rules to the
    // whole sign-up body (and store the trimmed name).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return
      const parsed = signUpBody.safeParse(ctx.body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new APIError("BAD_REQUEST", {
          code: "VALIDATION_ERROR",
          message: issue?.message ?? "ข้อมูลไม่ถูกต้อง",
          field: issue?.path.join("."),
        })
      }
      return { context: { body: { ...ctx.body, ...parsed.data } } }
    }),
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
