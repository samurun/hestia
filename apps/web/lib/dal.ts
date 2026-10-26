import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import { serverApi } from "./server-api"

// Data access layer: the real auth check for pages. proxy.ts only checks
// that a session cookie exists; the API decides whether it is valid.

/** The signed-in user and active org, or null without a valid session. */
export const getMe = cache(async () => {
  const { data, status } = await (await serverApi()).me.get()
  if (status === 401) return null
  if (!data) throw new Error(`GET /me failed with ${status}`)
  return data
})

export type Me = NonNullable<Awaited<ReturnType<typeof getMe>>>

export async function requireMe(): Promise<Me> {
  const me = await getMe()
  if (!me) redirect("/login")
  return me
}

/** Pages inside the app shell need an org; send new users to create one. */
export async function requireActiveOrg() {
  const me = await requireMe()
  if (!me.activeOrg) redirect("/onboarding")
  return { ...me, activeOrg: me.activeOrg }
}

/** Members and invitations of the active org; owners only (else null). */
export const getTeam = cache(async () => {
  const api = await serverApi()
  const [members, invitations] = await Promise.all([
    api.memberships.get(),
    api.invitations.get(),
  ])
  if (!members.data || !invitations.data) return null
  return { members: members.data, invitations: invitations.data }
})

/** What an invite link points to, or null if the token is unknown. */
export const getInvitePreview = cache(async (token: string) => {
  const { data } = await (
    await serverApi()
  ).invitations
    .preview({ token })
    .get()
  return data ?? null
})

export const getOrganizations = cache(async () => {
  const { data } = await (await serverApi()).organizations.get()
  return data ?? []
})
