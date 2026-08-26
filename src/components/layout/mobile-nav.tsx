"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavForBusinessType, MOBILE_PRIMARY_HREFS } from "@/lib/nav-config";
import type { BusinessType, FeatureKey } from "@/types/database";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({
  businessType,
  enabledFeatures,
}: {
  businessType: BusinessType;
  enabledFeatures: FeatureKey[];
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const allItems = React.useMemo(
    () => getNavForBusinessType(businessType, new Set(enabledFeatures)).flatMap((g) => g.items),
    [businessType, enabledFeatures],
  );
  const primaryItems = React.useMemo(
    () =>
      MOBILE_PRIMARY_HREFS.map((href) => allItems.find((i) => i.href === href)).filter(
        (i): i is NonNullable<typeof i> => Boolean(i),
      ),
    [allItems],
  );
  const moreItems = React.useMemo(
    () => allItems.filter((i) => !MOBILE_PRIMARY_HREFS.includes(i.href)),
    [allItems],
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card md:hidden">
      {primaryItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
            )}
          >
            <Menu className="size-5" />
            Más
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Más opciones</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-6">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 text-center text-xs font-medium text-foreground"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="size-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
