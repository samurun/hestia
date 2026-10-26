"use client"

import { useRouter } from "next/navigation"

import { authErrorMessage } from "@/features/auth/errors"
import { inviteSignupSchema, signupSchema } from "@/features/auth/schemas"
import { useFormSubmit } from "@/hooks/use-form-submit"
import { browserApi } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

/**
 * Sign-up and the first organization in one form. The API keeps them as two
 * calls so invited users can sign up without creating an org.
 */
export function useSignup() {
  const router = useRouter()

  return useFormSubmit(signupSchema, async ({ orgName, ...account }) => {
    const { error } = await authClient.signUp.email(account)
    if (error) return authErrorMessage(error.code)

    const org = await browserApi().organizations.post({ name: orgName })
    // The account exists either way; onboarding lets them retry the org.
    router.replace(org.error ? "/onboarding" : "/")
    router.refresh()
  })
}

/** Sign-up from an invite link: create the account, then join right away. */
export function useInviteSignup(token: string) {
  const router = useRouter()

  return useFormSubmit(inviteSignupSchema, async (account) => {
    const { error } = await authClient.signUp.email(account)
    if (error) return authErrorMessage(error.code)

    const joined = await browserApi().invitations.accept.post({ token })
    // If joining fails the invite page explains why and can retry.
    router.replace(joined.error ? `/invite/${token}` : "/")
    router.refresh()
  })
}
