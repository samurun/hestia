import type { Metadata } from "next"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { requireActiveOrg } from "@/lib/dal"
import { roleLabels } from "@/features/org/roles"

export const metadata: Metadata = { title: "ภาพรวม" }

// Placeholders until the modules that fill them land (phases 1–4).
const stats = [
  { label: "ห้องว่าง", hint: "เมื่อเพิ่มโครงการและห้องแล้ว" },
  { label: "ยอดค้างชำระ", hint: "เมื่อเริ่มออกบิลแล้ว" },
  { label: "สลิปรอตรวจ", hint: "เมื่อผู้เช่าเริ่มแนบสลิป" },
]

export default async function DashboardPage() {
  const me = await requireActiveOrg()

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold">สวัสดี {me.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          {me.activeOrg.name} · {roleLabels[me.activeOrg.role]}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">—</CardTitle>
              <CardDescription className="text-xs">{stat.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  )
}
