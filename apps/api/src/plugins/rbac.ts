import { Elysia } from "elysia"

import type { OrgMembership } from "../org-model"
import { can, type Permission } from "../rbac"
import { orgPlugin } from "./org"

/**
 * Adds `permission: "<name>"` on top of `org: true`: the caller's role in the
 * active org must allow it (see rbac.ts), otherwise 403.
 */
export const rbacPlugin = new Elysia({ name: "rbac" }).use(orgPlugin).macro({
  permission: (permission: Permission) => ({
    org: true,
    beforeHandle(ctx) {
      // Elysia 1.4 runs the org macro first but doesn't type its result here.
      const { org } = ctx as typeof ctx & { org?: OrgMembership }
      // Fail closed if the org context is missing for any reason.
      if (!org || !can(org.role, permission)) {
        return ctx.status(403, { message: "Forbidden" })
      }
    },
  }),
})
