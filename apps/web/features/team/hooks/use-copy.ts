"use client"

import { toast } from "sonner"

export function useCopy() {
  return async (text: string) => {
    try {
      // Missing on insecure origins (e.g. http://<LAN IP>) or when denied.
      await navigator.clipboard.writeText(text)
      toast.success("คัดลอกลิงก์แล้ว")
    } catch {
      toast.error("คัดลอกไม่สำเร็จ กรุณาเลือกลิงก์แล้วคัดลอกเอง")
    }
  }
}
