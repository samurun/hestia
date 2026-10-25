"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { useCreateOrg } from "@/features/org/hooks/use-create-org"

export function CreateOrgForm() {
  const { onSubmit, fieldErrors, error, pending } = useCreateOrg()

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!fieldErrors.orgName}>
          <FieldLabel htmlFor="orgName">ชื่อกิจการ</FieldLabel>
          <Input
            id="orgName"
            name="orgName"
            placeholder="เช่น บ้านเช่าลุงดำ"
            aria-invalid={!!fieldErrors.orgName}
          />
          <FieldError errors={fieldErrors.orgName} />
        </Field>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังสร้าง…" : "สร้างองค์กร"}
        </Button>
      </FieldGroup>
    </form>
  )
}
