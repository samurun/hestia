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
  submit: Submit<z.infer<S>>
) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<z.infer<S>>>({})
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    const parsed = parseForm(schema, new FormData(event.currentTarget))
    setFieldErrors(parsed.success ? {} : parsed.errors)
    if (!parsed.success) return

    setPending(true)
    const message = await submit(parsed.data).catch(() => unexpected)
    // On success the page navigates away, so it stays pending until then.
    if (message) {
      setError(message)
      setPending(false)
    }
  }

  return { onSubmit, fieldErrors, error, pending }
}
