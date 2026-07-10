import { requireUser, getCurrentUserPermissions } from "@/server/auth/require-permission";
import { PermissionProvider } from "@/features/auth/permission-context";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permissions = await getCurrentUserPermissions();

  return (
    <PermissionProvider permissions={permissions}>
      <div className="flex h-screen overflow-hidden">
        <SidebarNav />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar name={user.name} email={user.email} roles={user.roles} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </PermissionProvider>
  );
}
