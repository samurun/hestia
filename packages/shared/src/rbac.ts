/** Must match the member_role enum in packages/db (checked by an API test). */
export const memberRoles = ["owner", "manager", "staff"] as const
export type MemberRole = (typeof memberRoles)[number]

export const roleLabels: Record<MemberRole, string> = {
  owner: "เจ้าของ",
  manager: "ผู้จัดการ",
  staff: "พนักงาน",
}

// The one place that decides what each role may do (docs/SPEC.md §4). The
// API enforces it; the web uses it only to hide what the user can't do.
// Property scoping is separate: RLS limits managers and staff to the
// properties assigned to them.

const everyone = ["owner", "manager", "staff"] as const
const managers = ["owner", "manager"] as const
const owner = ["owner"] as const

export const permissions = {
  /** Org settings, tax details, PromptPay, SaaS plan. */
  "org.manage": owner,
  /** Users, roles and property assignments. */
  "members.manage": owner,
  /** See every property without assignments (mirrors the SQL policies). */
  "properties.all": owner,
  "properties.manage": managers,
  "contracts.manage": managers,
  "contracts.draft": everyone,
  "tenants.pii.read": managers,
  "meters.record": everyone,
  "invoices.issue": managers,
  "payments.confirm": everyone,
  /** Waive late fees, credit/debit notes, void invoices. */
  "billing.adjust": managers,
  "maintenance.create": everyone,
  "reports.finance": managers,
  "audit.read": owner,
} as const satisfies Record<string, readonly MemberRole[]>

export type Permission = keyof typeof permissions

export function can(role: MemberRole, permission: Permission): boolean {
  return (permissions[permission] as readonly MemberRole[]).includes(role)
}
