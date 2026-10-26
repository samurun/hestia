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

import { useInviteSignup } from "@/features/auth/hooks/use-signup"

export function InviteSignupForm({
  token,
  email,
  orgName,
}: {
  token: string
  email: string
  orgName: string
}) {
  const { onSubmit, fieldErrors, error, pending } = useInviteSignup(token)

  return (
    <Card>
      <CardHeader>
        <CardTitle>สมัครเพื่อเข้าร่วม {orgName}</CardTitle>
        <CardDescription>ใช้อีเมลที่ได้รับเชิญ</CardDescription>
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
            <Field>
              <FieldLabel htmlFor="email">อีเมล</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                readOnly
              />
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
            <FieldError>{error}</FieldError>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังสมัคร…" : "สมัครและเข้าร่วม"}
              </Button>
              <FieldDescription className="text-center">
                มีบัญชีแล้ว?{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                >
                  เข้าสู่ระบบ
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
