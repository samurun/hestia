"use client"

import {
  CheckIcon,
  ChevronsUpDownIcon,
  HouseIcon,
  PlusIcon,
} from "lucide-react"
import Link from "next/link"

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

import { useSwitchOrg } from "@/features/org/hooks/use-switch-org"
import { roleLabels } from "@/features/org/roles"

type Org = { id: string; name: string; role: keyof typeof roleLabels }

export function OrgSwitcher({ orgs, active }: { orgs: Org[]; active: Org }) {
  const switchTo = useSwitchOrg(active.id)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label="เลือกองค์กร" />}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <HouseIcon className="size-4" />
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{active.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabels[active.role]}
              </span>
            </span>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>องค์กร</DropdownMenuLabel>
              {orgs.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => switchTo(org.id)}>
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === active.id && <CheckIcon />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/onboarding" />}>
              <PlusIcon />
              สร้างองค์กรใหม่
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
