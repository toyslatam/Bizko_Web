"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Tags,
  BarChart3,
  Activity,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Empresas", href: "/admin/empresas", icon: Building2 },
  { label: "Usuarios", href: "/admin/usuarios", icon: Users },
  { label: "Suscripciones", href: "/admin/suscripciones", icon: CreditCard },
  { label: "Planes", href: "/admin/planes", icon: Tags },
  { label: "Uso", href: "/admin/uso", icon: BarChart3 },
  { label: "Actividad", href: "/admin/actividad", icon: Activity },
  { label: "Soporte", href: "/admin/soporte", icon: LifeBuoy },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:pb-0">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
