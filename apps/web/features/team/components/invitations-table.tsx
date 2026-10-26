"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  invitationStatusLabels,
  type InvitationStatus,
  type MemberRole,
} from "@workspace/shared"

import { roleLabels } from "@/features/org/roles"
import { useRevokeInvitation } from "@/features/team/hooks/use-revoke-invitation"
import { formatDate } from "@/lib/format"

type Invitation = {
  id: string
  email: string
  role: MemberRole
  status: InvitationStatus
  expiresAt: string
}

export function InvitationsTable({
  invitations,
}: {
  invitations: Invitation[]
}) {
  const { revoke, pendingId } = useRevokeInvitation()

  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีคำเชิญ</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>อีเมล</TableHead>
          <TableHead>บทบาท</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead className="text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invitation) => (
          <TableRow key={invitation.id}>
            <TableCell>{invitation.email}</TableCell>
            <TableCell>{roleLabels[invitation.role]}</TableCell>
            <TableCell>
              <Badge
                variant={invitation.status === "pending" ? "outline" : "ghost"}
              >
                {invitationStatusLabels[invitation.status]}
              </Badge>
              {invitation.status === "pending" && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ถึง {formatDate(invitation.expiresAt)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {invitation.status === "pending" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === invitation.id}
                  onClick={() => revoke(invitation.id)}
                >
                  {pendingId === invitation.id ? "กำลังยกเลิก…" : "ยกเลิก"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
