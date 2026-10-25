/**
 * The post-login destination from a `next` query value, limited to paths on
 * this site so a crafted link can't bounce users to another domain.
 */
export function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  if (value.includes("\\")) return "/"
  return value
}
