import { can } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { roleLabels } from "@/features/org/roles"

type Member = {
  id: string
  role: keyof typeof roleLabels
  user: { name: string; email: string }
  propertyIds: string[]
}

export function MembersTable({ members }: { members: Member[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ชื่อ</TableHead>
          <TableHead>บทบาท</TableHead>
          <TableHead className="text-right">โครงการที่ดูแล</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="font-medium">{member.user.name}</div>
              <div className="text-xs text-muted-foreground">
                {member.user.email}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={member.role === "owner" ? "default" : "secondary"}
              >
                {roleLabels[member.role]}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {can(member.role, "properties.all")
                ? "ทั้งหมด"
                : member.propertyIds.length}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
