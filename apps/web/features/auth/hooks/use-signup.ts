"use client"

import { useRouter } from "next/navigation"

import { authErrorMessage } from "@/features/auth/errors"
import { signupSchema } from "@/features/auth/schemas"
import { useFormSubmit } from "@/hooks/use-form-submit"
import { browserApi } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

/**
 * Sign-up and the first organization in one form. The API keeps them as two
 * calls so invited users (#7) can sign up without creating an org.
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
