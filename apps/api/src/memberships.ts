import {
  and,
  asc,
  eq,
  exists,
  schema,
  sql,
  withContext,
  type Tx,
} from "@workspace/db"

import { db } from "./db"
import { pickDefaultOrg, type OrgMembership } from "./org-model"

const { memberships, organizations, sessions, users } = schema

const membershipFields = {
  id: organizations.id,
  name: organizations.name,
  role: memberships.role,
}

/** Every org the user belongs to, with their role in it. */
export function listMemberships(userId: string): Promise<OrgMembership[]> {
  return withContext(db, { userId }, (tx) =>
    tx
      .select(membershipFields)
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(organizations.name), asc(organizations.id))
  )
}

/**
 * The user's membership in one org, or null. This is the authorization
 * check: never trust a stored org id without it.
 */
export async function findMembership(
  userId: string,
  orgId: string
): Promise<OrgMembership | null> {
  const [membership] = await withContext(db, { userId }, (tx) =>
    tx
      .select(membershipFields)
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
      .limit(1)
  )
  return membership ?? null
}

/**
 * Points the session (and the user's last-used org) at `orgId`, in the same
 * statement that checks membership. Returns false when the user is not a
 * member. `tx` must carry the user's context so the membership is visible.
 */
export async function setActiveOrg(
  tx: Tx,
  {
    sessionId,
    userId,
    orgId,
  }: { sessionId: string; userId: string; orgId: string }
): Promise<boolean> {
  const isMember = exists(
    tx
      .select({ one: sql`1` })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
  )
  const updated = await tx
    .update(sessions)
    .set({ activeOrgId: orgId })
    .where(
      and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isMember)
    )
    .returning({ id: sessions.id })
  if (updated.length === 0) return false

  await tx
    .update(users)
    .set({ lastActiveOrgId: orgId })
    .where(eq(users.id, userId))
  return true
}

/** The org a new session for this user should start in. */
export async function defaultActiveOrgId(
  userId: string
): Promise<string | null> {
  const [user] = await db
    .select({ lastActiveOrgId: users.lastActiveOrgId })
    .from(users)
    .where(eq(users.id, userId))
  return pickDefaultOrg(
    user?.lastActiveOrgId ?? null,
    await listMemberships(userId)
  )
}
