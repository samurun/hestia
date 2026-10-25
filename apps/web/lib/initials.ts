/** Up to two initials for an avatar, e.g. "Somchai Jaidee" → "SJ". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words.at(-1)] : words
  return letters
    .map((word) => [...(word ?? "")][0] ?? "")
    .join("")
    .toUpperCase()
}
