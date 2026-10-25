import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LoginForm } from "@/features/auth/components/login-form"
import { getMe } from "@/lib/dal"
import { safeNext } from "@/lib/safe-next"
import { loadLoginSearchParams } from "@/lib/search-params"

export const metadata: Metadata = { title: "เข้าสู่ระบบ" }

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await loadLoginSearchParams(props.searchParams)
  if (await getMe()) redirect(safeNext(next))
  return <LoginForm />
}
