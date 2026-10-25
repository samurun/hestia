export type OpenAPIPaths = Record<string, Record<string, { tags?: string[] }>>

/** Better Auth paths are relative to its basePath; tag them for Scalar. */
export function prefixAuthPaths(paths: OpenAPIPaths, prefix = "/api/auth") {
  const result: OpenAPIPaths = {}
  for (const [path, operations] of Object.entries(paths)) {
    result[prefix + path] = Object.fromEntries(
      Object.entries(operations).map(([method, op]) => [
        method,
        { ...op, tags: ["Auth"] },
      ])
    )
  }
  return result
}
