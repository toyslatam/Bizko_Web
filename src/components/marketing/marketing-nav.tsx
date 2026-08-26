"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Wallet,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketingNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const MARKETING_NAV_ITEMS: MarketingNavItem[] = [
  { label: "Resumen", href: "/marketing", icon: LayoutDashboard },
  { label: "Campañas", href: "/marketing/campanas", icon: Megaphone },
  { label: "Segmentos", href: "/marketing/segmentos", icon: Users },
  { label: "Calendario", href: "/marketing/calendario", icon: CalendarDays },
  { label: "Créditos", href: "/marketing/creditos", icon: Wallet },
];

export function MarketingNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {MARKETING_NAV_ITEMS.map((item) => {
        const active =
          item.href === "/marketing" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground",
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
