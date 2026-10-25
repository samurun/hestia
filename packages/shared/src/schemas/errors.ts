import { z } from "zod"

/** Errors the API returns itself (401/403/404, business-rule 422). */
export const messageError = z.object({ message: z.string() })

/**
 * Elysia's request-validation 422. `message` is the Thai text from the
 * failing schema; other keys (found, errors, …) vary and are passed through.
 */
export const validationError = z
  .object({
    type: z.literal("validation"),
    on: z.string(),
    property: z.string().optional(),
    message: z.string(),
  })
  .loose()
