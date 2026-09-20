"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavForBusinessType, type NavGroup } from "@/lib/nav-config";
import { daysUntil, SUBSCRIPTION_STATUS_LABELS } from "@/lib/plans";
import { Sparkles } from "lucide-react";
import type { BusinessType, FeatureKey, Plan, Subscription } from "@/types/database";

export function Sidebar({
  businessType,
  enabledFeatures,
  subscription,
  plan,
}: {
  businessType: BusinessType;
  enabledFeatures: FeatureKey[];
  subscription: Subscription | null;
  plan: Plan | null;
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

      <PlanCard subscription={subscription} plan={plan} />
    </aside>
  );
}

/**
 * Ocupa el pie de la barra lateral, que si no queda como una franja oscura
 * vacía desde el último ítem hasta abajo. Reusa lo que el AppShell ya tiene
 * cargado, así que no cuesta una consulta extra.
 */
function PlanCard({
  subscription,
  plan,
}: {
  subscription: Subscription | null;
  plan: Plan | null;
}) {
  if (!subscription || !plan) return null;

  const trialDays = subscription.status === "trial" ? daysUntil(subscription.trial_ends_at) : null;

  return (
    <div className="border-t border-white/10 p-3">
      <Link
        href="/configuracion?tab=plan"
        className="block rounded-lg bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-sidebar-foreground/60" />
          <span className="truncate text-sm font-medium text-white">Plan {plan.name}</span>
        </div>
        <p className="mt-0.5 text-xs text-sidebar-foreground/60">
          {trialDays !== null && trialDays > 0
            ? `Prueba · ${trialDays} día${trialDays === 1 ? "" : "s"} restantes`
            : SUBSCRIPTION_STATUS_LABELS[subscription.status]}
        </p>
        <p className="mt-1.5 text-xs font-medium text-sidebar-primary underline underline-offset-2">
          Administrar plan
        </p>
      </Link>
    </div>
  );
}
