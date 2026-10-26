/**
 * The Thai message from an Eden error. The API puts one in `message` for
 * both its own errors and request validation (from @workspace/shared).
 */
export function apiErrorMessage(
  error: { value: unknown } | null | undefined,
  fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
): string {
  const value = error?.value
  if (value && typeof value === "object" && "message" in value) {
    const { message } = value as { message: unknown }
    if (typeof message === "string" && message) return message
  }
  return fallback
}
