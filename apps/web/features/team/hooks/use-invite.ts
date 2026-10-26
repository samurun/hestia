"use client"

import type { MemberRole } from "@workspace/shared"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { inviteSchema } from "@/features/team/schemas"
import { useFormSubmit } from "@/hooks/use-form-submit"
import { browserApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-error"

const defaultRole: MemberRole = "staff"

/** Sends an invite and keeps the link so the owner can share it (e.g. LINE). */
export function useInvite() {
  const router = useRouter()
  const [link, setLink] = useState<{
    email: string
    url: string
    expiresAt: string
  }>()
  // Controlled: form.reset() doesn't reset the select's own state, so the
  // hook owns the value and resets it with the form.
  const [role, setRole] = useState<MemberRole>(defaultRole)

  const form = useFormSubmit(
    inviteSchema,
    async (data) => {
      setLink(undefined)
      const { data: created, error } = await browserApi().invitations.post({
        ...data,
        propertyIds: [],
      })
      if (error) return apiErrorMessage(error, "ส่งคำเชิญไม่สำเร็จ")
      setLink({
        email: created.invitation.email,
        url: created.url,
        expiresAt: created.invitation.expiresAt,
      })
      setRole(defaultRole)
      router.refresh()
    },
    { resetOnSuccess: true }
  )

  return { ...form, link, role, setRole }
}
