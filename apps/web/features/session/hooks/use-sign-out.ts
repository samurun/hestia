"use client"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"

export function useSignOut() {
  const router = useRouter()

  return async () => {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }
}
