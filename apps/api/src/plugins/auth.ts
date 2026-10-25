import { Elysia } from "elysia"

import { auth } from "../auth"

/** Serves /api/auth/* and adds the `auth: true` route option. */
export const authPlugin = new Elysia({ name: "auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) return status(401, { message: "Unauthorized" })
        return { user: session.user, session: session.session }
      },
    },
  })
