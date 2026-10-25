import type { Metadata } from "next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { CreateOrgForm } from "@/features/org/components/create-org-form"
import { requireMe } from "@/lib/dal"

export const metadata: Metadata = { title: "สร้างองค์กร" }

export default async function OnboardingPage() {
  const me = await requireMe()
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {me.activeOrg ? "สร้างองค์กรใหม่" : `ยินดีต้อนรับ ${me.user.name}`}
          </CardTitle>
          <CardDescription>
            องค์กรคือกิจการให้เช่าของคุณ หนึ่งบัญชีมีได้หลายองค์กร
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </main>
  )
}
