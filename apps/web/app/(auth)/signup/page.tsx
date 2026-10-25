import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignupForm } from "@/features/auth/components/signup-form"
import { getMe } from "@/lib/dal"

export const metadata: Metadata = { title: "สมัครใช้งาน" }

export default async function SignupPage() {
  if (await getMe()) redirect("/")
  return <SignupForm />
}
