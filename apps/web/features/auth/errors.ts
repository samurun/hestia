const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  USER_ALREADY_EXISTS: "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน",
  PASSWORD_TOO_SHORT: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
  PASSWORD_TOO_LONG: "รหัสผ่านยาวเกินไป",
  INVALID_EMAIL: "รูปแบบอีเมลไม่ถูกต้อง",
}

/** Thai message for a Better Auth error code. */
export function authErrorMessage(code: string | undefined): string {
  return (code && messages[code]) || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
}
