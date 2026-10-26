"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { browserApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-error"

export function useAcceptInvite(token: string) {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function accept() {
    setPending(true)
    setError(undefined)
    const res = await browserApi().invitations.accept.post({ token })
    if (res.error) {
      setError(apiErrorMessage(res.error, "เข้าร่วมไม่สำเร็จ"))
      setPending(false)
      return
    }
    router.replace("/")
    router.refresh()
  }

  return { accept, error, pending }
}
