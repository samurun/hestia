import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { can } from "@workspace/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { InvitationsTable } from "@/features/team/components/invitations-table"
import { InviteForm } from "@/features/team/components/invite-form"
import { MembersTable } from "@/features/team/components/members-table"
import { getTeam, requireActiveOrg } from "@/lib/dal"

export const metadata: Metadata = { title: "ทีมงาน" }

export default async function TeamPage() {
  const me = await requireActiveOrg()
  if (!can(me.activeOrg.role, "members.manage")) notFound()
  const team = await getTeam()
  if (!team) notFound()

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold">ทีมงาน</h1>
        <p className="text-sm text-muted-foreground">
          เชิญคนเข้าร่วม {me.activeOrg.name} และดูว่าใครทำอะไรได้บ้าง
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>เชิญสมาชิก</CardTitle>
          <CardDescription>
            ผู้ได้รับเชิญต้องสมัครหรือเข้าสู่ระบบด้วยอีเมลนี้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>สมาชิก ({team.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersTable members={team.members} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>คำเชิญ</CardTitle>
        </CardHeader>
        <CardContent>
          <InvitationsTable invitations={team.invitations} />
        </CardContent>
      </Card>
    </>
  )
}
