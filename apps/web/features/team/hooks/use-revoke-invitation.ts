"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { browserApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-error"

export function useRevokeInvitation() {
  const router = useRouter()
  /** The invite being revoked; its button stays disabled meanwhile. */
  const [pendingId, setPendingId] = useState<string>()

  async function revoke(invitationId: string) {
    if (pendingId) return
    setPendingId(invitationId)
    const { error } = await browserApi().invitations({ invitationId }).delete()
    setPendingId(undefined)
    if (error) {
      toast.error(apiErrorMessage(error, "ยกเลิกคำเชิญไม่สำเร็จ"))
      return
    }
    toast.success("ยกเลิกคำเชิญแล้ว")
    router.refresh()
  }

  return { revoke, pendingId }
}
