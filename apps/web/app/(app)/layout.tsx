import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { getOrganizations, requireActiveOrg } from "@/lib/dal"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layouts don't re-run on client navigation, so pages check again too.
  const [me, orgs] = await Promise.all([requireActiveOrg(), getOrganizations()])

  return (
    <SidebarProvider>
      <AppSidebar user={me.user} orgs={orgs} activeOrg={me.activeOrg} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="truncate text-sm font-medium">
            {me.activeOrg.name}
          </span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
