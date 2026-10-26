"use client"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"

export function useSignOut(redirectTo = "/login") {
  const router = useRouter()

  return async () => {
    await authClient.signOut()
    router.replace(redirectTo)
    router.refresh()
  }
}
