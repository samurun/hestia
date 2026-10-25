"use client"

import { useRouter } from "next/navigation"

import { createOrgSchema } from "@/features/org/schemas"
import { useFormSubmit } from "@/hooks/use-form-submit"
import { browserApi } from "@/lib/api"

export function useCreateOrg() {
  const router = useRouter()

  return useFormSubmit(createOrgSchema, async ({ orgName }) => {
    const { error } = await browserApi().organizations.post({ name: orgName })
    if (error) return "สร้างองค์กรไม่สำเร็จ กรุณาตรวจชื่อแล้วลองใหม่"
    router.replace("/")
    router.refresh()
  })
}
