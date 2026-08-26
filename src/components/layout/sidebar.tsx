"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavForBusinessType, type NavGroup } from "@/lib/nav-config";
import type { BusinessType, FeatureKey } from "@/types/database";

export function Sidebar({
  businessType,
  enabledFeatures,
}: {
  businessType: BusinessType;
  enabledFeatures: FeatureKey[];
}) {
  const pathname = usePathname();
  const nav: NavGroup[] = getNavForBusinessType(businessType, new Set(enabledFeatures));

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <Image
          src="/files/app_icon.svg"
          alt=""
          width={28}
          height={28}
          className="rounded-md"
        />
        <span className="font-heading text-lg font-semibold text-white">
          bizko
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {nav.map((group, i) => (
          <div key={i}>
            {group.label && (
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-sidebar-foreground/50 uppercase">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
