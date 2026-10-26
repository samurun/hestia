"use client"

import { useState } from "react"
import type { z } from "zod"

import { parseForm, type FieldErrors } from "@/lib/form"

/** Does the work; returns a message to show, or nothing on success. */
export type Submit<T> = (data: T) => Promise<string | undefined>

const unexpected = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"

/**
 * The shared shape of every form: validate with zod, show field errors,
 * track pending, show the action's error. Feature hooks only supply
 * `submit`; components only render what this returns.
 */
export function useFormSubmit<S extends z.ZodObject>(
  schema: S,
  submit: Submit<z.infer<S>>,
  /** Forms that stay on the page clear themselves; others navigate away. */
  { resetOnSuccess = false }: { resetOnSuccess?: boolean } = {}
) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<z.infer<S>>>({})
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError(undefined)
    const parsed = parseForm(schema, new FormData(form))
    setFieldErrors(parsed.success ? {} : parsed.errors)
    if (!parsed.success) return

    setPending(true)
    const message = await submit(parsed.data).catch(() => unexpected)
    if (message) {
      setError(message)
      setPending(false)
    } else if (resetOnSuccess) {
      form.reset()
      setPending(false)
    }
    // Otherwise the page navigates away, so it stays pending until then.
  }

  return { onSubmit, fieldErrors, error, pending }
}
