import { z } from "zod"

// Mirrors the API's rule: 1–200 characters after trimming.
export const orgNameSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อกิจการ")
  .max(200, "ชื่อกิจการยาวได้ไม่เกิน 200 ตัวอักษร")

export const createOrgSchema = z.object({ orgName: orgNameSchema })
