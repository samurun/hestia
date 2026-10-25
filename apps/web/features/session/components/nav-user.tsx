"use client"

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { useSignOut } from "@/features/session/hooks/use-sign-out"
import { initials } from "@/lib/initials"

export function NavUser({ user }: { user: { name: string; email: string } }) {
  const signOut = useSignOut()

  const avatar = (
    <Avatar className="size-8 rounded-md">
      <AvatarFallback className="rounded-md">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label="เมนูผู้ใช้" />}
          >
            {avatar}
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </span>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="min-w-56">
            {/* Base UI menu labels must sit inside a group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                {avatar}
                <span className="grid leading-tight">
                  <span className="truncate font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="truncate text-xs">{user.email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
