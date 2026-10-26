import type { MemberRole } from "@workspace/shared"

export { roleLabels } from "@workspace/shared"

/** Roles in the order an owner picks from when inviting. */
export const invitableRoles: MemberRole[] = ["staff", "manager", "owner"]
