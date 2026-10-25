import type { z } from "zod"

export type FieldErrors<T> = Partial<Record<keyof T, { message: string }[]>>

/**
 * Validates a submitted form. Errors come back per field in the shape
 * <FieldError errors={...}> expects.
 */
export function parseForm<S extends z.ZodObject>(
  schema: S,
  form: FormData
):
  | { success: true; data: z.infer<S> }
  | { success: false; errors: FieldErrors<z.infer<S>> } {
  const result = schema.safeParse(Object.fromEntries(form))
  if (result.success) return { success: true, data: result.data }

  const errors: FieldErrors<z.infer<S>> = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof z.infer<S>
    ;(errors[key] ??= []).push({ message: issue.message })
  }
  return { success: false, errors }
}
