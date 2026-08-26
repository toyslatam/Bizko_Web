import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { daysUntil } from "@/lib/plans";
import type { Plan, Subscription } from "@/types/database";

export function PlanBanner({
  subscription,
  plan,
}: {
  subscription: Subscription | null;
  plan: Plan | null;
}) {
  if (!subscription) return null;

  if (subscription.status === "trial") {
    const days = daysUntil(subscription.trial_ends_at);
    if (days === null) return null;
    return (
      <Banner tone={days <= 3 ? "warning" : "info"} icon={Clock}>
        {days > 0
          ? `Tu prueba del plan ${plan?.name ?? ""} termina en ${days} día${days === 1 ? "" : "s"}.`
          : "Tu período de prueba terminó."}{" "}
        <Link href="/configuracion?tab=plan" className="font-medium underline underline-offset-2">
          Ver planes
        </Link>
      </Banner>
    );
  }

  if (subscription.status === "past_due") {
    return (
      <Banner tone="warning" icon={AlertTriangle}>
        Hay un problema con el pago de tu suscripción.{" "}
        <Link href="/configuracion?tab=plan" className="font-medium underline underline-offset-2">
          Administrar plan
        </Link>
      </Banner>
    );
  }

  if (subscription.status === "suspended" || subscription.status === "expired") {
    return (
      <Banner tone="destructive" icon={AlertTriangle}>
        {subscription.status === "suspended"
          ? "Tu cuenta está suspendida — algunas funciones están limitadas, pero tu información sigue guardada."
          : "Tu suscripción venció — algunas funciones están limitadas, pero tu información sigue guardada."}{" "}
        <Link href="/configuracion?tab=plan" className="font-medium underline underline-offset-2">
          Administrar plan
        </Link>
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "info" | "warning" | "destructive";
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  const toneClass = {
    info: "bg-brand/5 text-brand border-brand/20",
    warning: "bg-warning/10 text-warning-foreground border-warning/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
  }[tone];

  return (
    <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs font-medium md:px-6 ${toneClass}`}>
      <Icon className="size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
