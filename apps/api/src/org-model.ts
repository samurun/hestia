import { memberRole } from "@workspace/db/schema"
import { t } from "elysia"

// Pure types and rules for orgs; no DB or auth imports, so unit tests can
// load this without a database.

export const OrgMembership = t.Object({
  id: t.String({ format: "uuid" }),
  name: t.String(),
  role: t.UnionEnum(memberRole.enumValues),
})

export type OrgMembership = typeof OrgMembership.static

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
