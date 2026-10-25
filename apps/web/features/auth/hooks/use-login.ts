"use client"

import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"

import { authErrorMessage } from "@/features/auth/errors"
import { loginSchema } from "@/features/auth/schemas"
import { useFormSubmit } from "@/hooks/use-form-submit"
import { authClient } from "@/lib/auth-client"
import { safeNext } from "@/lib/safe-next"
import { loginSearchParams } from "@/lib/search-params"

export function useLogin() {
  const router = useRouter()
  const [next] = useQueryState("next", loginSearchParams.next)

  return useFormSubmit(loginSchema, async (credentials) => {
    const { error } = await authClient.signIn.email(credentials)
    if (error) return authErrorMessage(error.code)
    router.replace(safeNext(next))
    router.refresh()
  })
}
