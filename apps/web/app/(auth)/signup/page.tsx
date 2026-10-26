import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { invitationToken } from "@workspace/shared/schemas"

import { InviteSignupForm } from "@/features/auth/components/invite-signup-form"
import { SignupForm } from "@/features/auth/components/signup-form"
import { getInvitePreview, getMe } from "@/lib/dal"
import { loadSignupSearchParams } from "@/lib/search-params"

export const metadata: Metadata = { title: "สมัครใช้งาน" }

export default async function SignupPage(props: PageProps<"/signup">) {
  const { invite } = await loadSignupSearchParams(props.searchParams)
  // Only a well-formed token is ever put into a path; anything else is
  // treated as no invite at all.
  const token = invitationToken.safeParse(invite).data
  const invitePath = token ? `/invite/${encodeURIComponent(token)}` : null

  if (await getMe()) redirect(invitePath ?? "/")
  if (!token || !invitePath) return <SignupForm />

  const preview = await getInvitePreview(token)
  // A dead invite sends people to the invite page, which explains why.
  if (preview?.status !== "pending") redirect(invitePath)
  return (
    <InviteSignupForm
      token={token}
      email={preview.email}
      orgName={preview.orgName}
    />
  )
}
