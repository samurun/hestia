import { memberRole } from "@workspace/db/schema"
import { uuid } from "@workspace/shared/schemas"
import { z } from "zod"

// Pure types and rules for orgs; no DB or auth imports, so unit tests can
// load this without a database.

export const OrgMembership = z.object({
  id: uuid,
  name: z.string(),
  role: z.enum(memberRole.enumValues),
})

export type OrgMembership = z.infer<typeof OrgMembership>

/**
 * The org a new session should start in: the last one the user used if they
 * are still a member, otherwise their only org, otherwise none.
 */
export function pickDefaultOrg(
  lastActiveOrgId: string | null,
  orgs: Pick<OrgMembership, "id">[]
): string | null {
  if (lastActiveOrgId && orgs.some((org) => org.id === lastActiveOrgId)) {
    return lastActiveOrgId
  }
  return orgs.length === 1 ? orgs[0]!.id : null
}

export type OrgAccess =
  { ok: true; org: OrgMembership } | { ok: false; message: string }

export const NOT_MEMBER = "Not a member of this organization"

/**
 * Whether a request may act in the session's active org. `membership` must
 * be findMembership(user, activeOrgId), never derived from the session.
 */
export function checkOrgAccess(
  activeOrgId: string | null | undefined,
  membership: OrgMembership | null
): OrgAccess {
  if (!activeOrgId) return { ok: false, message: "No active organization" }
  if (!membership) return { ok: false, message: NOT_MEMBER }
  return { ok: true, org: membership }
}
