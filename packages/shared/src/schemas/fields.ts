import { z } from "zod"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../auth"

// Field rules with Thai messages, used by the API (request validation) and
// the web forms. The database keeps its own CHECKs as the last line.

/** Organization name: 1–200 characters after trimming (DB CHECK matches). */
export const orgName = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อกิจการ")
  .max(200, "ชื่อกิจการยาวได้ไม่เกิน 200 ตัวอักษร")

export const personName = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อ")
  .max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร")

export const email = z.email("รูปแบบอีเมลไม่ถูกต้อง")

export const newPassword = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `รหัสผ่านยาวได้ไม่เกิน ${PASSWORD_MAX_LENGTH} ตัวอักษร`
  )

/** Sign-in only checks presence; the server decides if it's right. */
export const password = z.string().min(1, "กรุณากรอกรหัสผ่าน")

export const uuid = z.uuid("รหัสอ้างอิงไม่ถูกต้อง")
