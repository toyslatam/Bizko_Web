"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { switchCompanyAction } from "@/app/actions/switch-company";
import type { Membership } from "@/lib/auth/session";
import type { CompanyRole } from "@/types/database";
import { ROLE_LABELS } from "@/lib/permissions";

interface TopBarProps {
  companyName: string;
  userName: string;
  userEmail: string;
  memberships: Membership[];
  activeCompanyId: string;
  role: CompanyRole;
}

export function TopBar({
  companyName,
  userName,
  userEmail,
  memberships,
  activeCompanyId,
  role,
}: TopBarProps) {
  const router = useRouter();
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      {memberships.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-[60%] items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-foreground outline-none hover:bg-muted">
            <span className="truncate">{companyName}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Cambiar de negocio</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.company_id}
                onClick={() => switchCompanyAction(m.company_id)}
                className={m.company_id === activeCompanyId ? "font-medium text-brand" : ""}
              >
                {m.company.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="truncate text-sm font-medium text-foreground">{companyName}</span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none">
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand/15 text-xs font-semibold text-brand">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{userEmail}</p>
            <p className="mt-0.5 text-xs font-normal text-brand">{ROLE_LABELS[role]}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/configuracion">
              <User /> Mi perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/configuracion">
              <Settings /> Configuración
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            <LogOut /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
