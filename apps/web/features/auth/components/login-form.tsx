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
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { useLogin } from "@/features/auth/hooks/use-login"

export function LoginForm() {
  const { onSubmit, fieldErrors, error, pending } = useLogin()

  return (
    <Card>
      <CardHeader>
        <CardTitle>เข้าสู่ระบบ</CardTitle>
        <CardDescription>ใช้อีเมลและรหัสผ่านของคุณ</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
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
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.password}
              />
              <FieldError errors={fieldErrors.password} />
            </Field>
            <FieldError>{error}</FieldError>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </Button>
              <FieldDescription className="text-center">
                ยังไม่มีบัญชี? <Link href="/signup">สมัครใช้งาน</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
