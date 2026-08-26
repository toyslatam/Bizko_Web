import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionContext } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.isPlatformAdmin) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-sidebar px-4 text-white sm:px-6">
        <div className="flex items-center gap-2">
          <Image src="/files/app_icon.svg" alt="" width={26} height={26} className="rounded-md" />
          <span className="font-heading text-base font-semibold">bizko admin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium">Super Admin</span>
          <AdminLogoutButton />
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
        <AdminNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
