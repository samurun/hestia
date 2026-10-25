import { z } from "zod"

import { orgNameSchema } from "@/features/org/schemas"

// Client-side checks with Thai messages; the API validates again.

const email = z.email("รูปแบบอีเมลไม่ถูกต้อง")

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
})

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อ")
    .max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร"),
  email,
  password: z
    .string()
    .min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร")
    .max(128, "รหัสผ่านยาวได้ไม่เกิน 128 ตัวอักษร"),
  orgName: orgNameSchema,
})
