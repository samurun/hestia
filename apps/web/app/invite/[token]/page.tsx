import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { AcceptInvite } from "@/features/invite/components/accept-invite"
import { SwitchAccount } from "@/features/invite/components/switch-account"
import { invitationClosedMessages } from "@workspace/shared"
import { invitationToken } from "@workspace/shared/schemas"

import { roleLabels } from "@/features/org/roles"
import { getInvitePreview, getMe } from "@/lib/dal"

export const metadata: Metadata = { title: "คำเชิญ" }

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params
  // A malformed token can't match, so skip the lookup.
  const valid = invitationToken.safeParse(token).success
  const [preview, me] = await Promise.all([
    valid ? getInvitePreview(token) : null,
    getMe(),
  ])

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        {!preview ? (
          <CardHeader>
            <CardTitle>ไม่พบคำเชิญ</CardTitle>
            <CardDescription>
              ลิงก์อาจไม่ครบ ลองคัดลอกใหม่อีกครั้ง
            </CardDescription>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardTitle>เข้าร่วม {preview.orgName}</CardTitle>
              <CardDescription>
                ในฐานะ{roleLabels[preview.role]} · ส่งถึง {preview.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {preview.status !== "pending" ? (
                <p className="text-sm">
                  {invitationClosedMessages[preview.status]}
                </p>
              ) : !me ? (
                <>
                  <Button
                    render={
                      <Link
                        href={`/signup?invite=${encodeURIComponent(token)}`}
                      />
                    }
                  >
                    สมัครด้วย {preview.email}
                  </Button>
                  <Button
                    variant="outline"
                    render={
                      <Link
                        href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                      />
                    }
                  >
                    มีบัญชีแล้ว เข้าสู่ระบบ
                  </Button>
                </>
              ) : me.user.email.toLowerCase() !== preview.email ? (
                <>
                  <p className="text-sm">
                    คุณเข้าสู่ระบบด้วย {me.user.email} แต่คำเชิญนี้ส่งถึง{" "}
                    {preview.email}
                  </p>
                  <SwitchAccount token={token} />
                </>
              ) : (
                <AcceptInvite token={token} />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  )
}
