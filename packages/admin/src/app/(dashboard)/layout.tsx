import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import Topbar from "@/components/dashboard/topbar";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { resolveAdminSession } from "@/lib/api-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await resolveAdminSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
