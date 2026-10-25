"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { browserApi } from "@/lib/api"

/** Makes another org active and re-renders the app for it. */
export function useSwitchOrg(activeOrgId: string) {
  const router = useRouter()

  return async (orgId: string) => {
    if (orgId === activeOrgId) return
    const { error } = await browserApi().organizations.active.post({ orgId })
    if (error) {
      toast.error("สลับองค์กรไม่สำเร็จ")
      return
    }
    router.refresh()
  }
}
