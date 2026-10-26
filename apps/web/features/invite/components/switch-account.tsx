"use client"

import { Button } from "@workspace/ui/components/button"

import { useSignOut } from "@/features/session/hooks/use-sign-out"

/** Signs out and comes back to sign in with the invited address. */
export function SwitchAccount({ token }: { token: string }) {
  const signOut = useSignOut(
    `/login?next=${encodeURIComponent(`/invite/${token}`)}`
  )
  return (
    <Button variant="outline" onClick={signOut}>
      ออกจากระบบแล้วใช้บัญชีอื่น
    </Button>
  )
}
