"use client"

import { CopyIcon } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { MemberRole } from "@workspace/shared"

import { invitableRoles, roleLabels } from "@/features/org/roles"
import { useCopy } from "@/features/team/hooks/use-copy"
import { useInvite } from "@/features/team/hooks/use-invite"
import { formatDate } from "@/lib/format"

export function InviteForm() {
  const { onSubmit, fieldErrors, error, pending, link, role, setRole } =
    useInvite()
  const copy = useCopy()

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="sm:flex-row sm:items-start">
          <Field data-invalid={!!fieldErrors.email} className="sm:flex-1">
            <FieldLabel htmlFor="invite-email">อีเมล</FieldLabel>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="name@example.com"
              aria-invalid={!!fieldErrors.email}
            />
            <FieldError errors={fieldErrors.email} />
          </Field>
          <Field className="sm:w-40">
            <FieldLabel htmlFor="invite-role">บทบาท</FieldLabel>
            <Select
              name="role"
              value={role}
              onValueChange={(value) => setRole(value as MemberRole)}
              items={roleLabels}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {invitableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="sm:w-auto">
            <FieldLabel className="max-sm:hidden" aria-hidden>
              &nbsp;
            </FieldLabel>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังเชิญ…" : "ส่งคำเชิญ"}
            </Button>
          </Field>
        </FieldGroup>
        <FieldError className="mt-2">{error}</FieldError>
      </form>

      {link && (
        <Alert>
          <AlertTitle>เชิญ {link.email} แล้ว</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              ส่งลิงก์นี้ให้ผู้ได้รับเชิญ ใช้ได้ถึง {formatDate(link.expiresAt)}
            </span>
            <span className="flex items-center gap-2">
              <Input
                readOnly
                value={link.url}
                aria-label="ลิงก์คำเชิญ"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="คัดลอกลิงก์"
                onClick={() => copy(link.url)}
              >
                <CopyIcon />
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
