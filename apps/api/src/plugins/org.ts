import { sql, withContext, type Tx } from "@workspace/db"
import { Elysia, status } from "elysia"

import { auth } from "../auth"
import { db } from "../db"
import { findMembership } from "../memberships"
import { checkOrgAccess, NOT_MEMBER } from "../org-model"
import { authPlugin } from "./auth"

type AuthContext = {
  user: typeof auth.$Infer.Session.user
  session: typeof auth.$Infer.Session.session
}

/**
 * Adds the `org: true` route option on top of `auth: true`: the caller must be
 * a member of the session's active org. Handlers get `org` (with the caller's
 * role) and `orgTx`, which runs queries under that org's RLS context.
 */
export const orgPlugin = new Elysia({ name: "org" }).use(authPlugin).macro({
  org: {
    auth: true,
    async resolve(ctx) {
      // Elysia 1.4 runs the auth macro first but doesn't type its result here.
      const { user, session } = ctx as typeof ctx & AuthContext
      const activeOrgId = session.activeOrgId
      const access = checkOrgAccess(
        activeOrgId,
        activeOrgId ? await findMembership(user.id, activeOrgId) : null
      )
      if (!access.ok) return ctx.status(403, { message: access.message })

      // Read-only mode for unpaid orgs (phase 6) hooks in here.

      const { id: orgId, role } = access.org
      return {
        user,
        session,
        org: access.org,
        orgTx: <T>(fn: (tx: Tx) => Promise<T>) =>
          withContext(db, { orgId, userId: user.id }, async (tx) => {
            // Re-check inside the transaction and hold the membership row
            // (FOR SHARE), so a member removed or re-roled after resolve()
            // can't act on the stale membership.
            const [lock] = await tx.execute<{ role: string | null }>(
              sql`select app_lock_membership(${orgId}, ${user.id}) as role`
            )
            if (lock?.role !== role) throw status(403, { message: NOT_MEMBER })
            return fn(tx)
          }),
      }
    },
  },
})
