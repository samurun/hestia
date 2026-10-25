import { Elysia } from "elysia"

import { auth } from "../auth"

/** Serves /api/auth/* and adds the `auth: true` route option. */
export const authPlugin = new Elysia({ name: "auth" })
  // Only /api/auth/*: a root mount would answer every unmatched path in apps
  // that use this plugin. parse: "none" leaves the body for Better Auth.
  .all("/api/auth/*", ({ request }) => auth.handler(request), {
    parse: "none",
    detail: { hide: true },
  })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) return status(401, { message: "Unauthorized" })
        return { user: session.user, session: session.session }
      },
    },
  })
