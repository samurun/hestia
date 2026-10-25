"use client"

import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { useSignup } from "@/features/auth/hooks/use-signup"

export function SignupForm() {
  const { onSubmit, fieldErrors, error, pending } = useSignup()

  return (
    <Card>
      <CardHeader>
        <CardTitle>สมัครใช้งาน</CardTitle>
        <CardDescription>สร้างบัญชีและองค์กรของคุณ</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!fieldErrors.name}>
              <FieldLabel htmlFor="name">ชื่อของคุณ</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                aria-invalid={!!fieldErrors.name}
              />
              <FieldError errors={fieldErrors.name} />
            </Field>
            <Field data-invalid={!!fieldErrors.email}>
              <FieldLabel htmlFor="email">อีเมล</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
              />
              <FieldError errors={fieldErrors.email} />
            </Field>
            <Field data-invalid={!!fieldErrors.password}>
              <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
              />
              <FieldDescription>อย่างน้อย 8 ตัวอักษร</FieldDescription>
              <FieldError errors={fieldErrors.password} />
            </Field>
            <FieldSeparator />
            <Field data-invalid={!!fieldErrors.orgName}>
              <FieldLabel htmlFor="orgName">ชื่อกิจการ</FieldLabel>
              <Input
                id="orgName"
                name="orgName"
                placeholder="เช่น บ้านเช่าลุงดำ"
                aria-invalid={!!fieldErrors.orgName}
              />
              <FieldDescription>เปลี่ยนภายหลังได้</FieldDescription>
              <FieldError errors={fieldErrors.orgName} />
            </Field>
            <FieldError>{error}</FieldError>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังสร้างบัญชี…" : "สมัครใช้งาน"}
              </Button>
              <FieldDescription className="text-center">
                มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
