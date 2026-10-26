"use client"

import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"

import { useAcceptInvite } from "@/features/invite/hooks/use-accept-invite"

export function AcceptInvite({ token }: { token: string }) {
  const { accept, error, pending } = useAcceptInvite(token)

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={accept} disabled={pending}>
        {pending ? "กำลังเข้าร่วม…" : "เข้าร่วม"}
      </Button>
      <FieldError>{error}</FieldError>
    </div>
  )
}
