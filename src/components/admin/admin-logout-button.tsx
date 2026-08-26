"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20"
    >
      <LogOut className="size-3.5" /> Cerrar sesión
    </button>
  );
}
