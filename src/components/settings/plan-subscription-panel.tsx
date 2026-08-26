"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SUBSCRIPTION_STATUS_LABELS,
  PLAN_LIMIT_LABELS,
  formatLimitValue,
  formatPlanPrice,
  usagePct,
  daysUntil,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { FeatureKey, Plan, PlanUsageRow, Subscription } from "@/types/database";

interface PlanWithFeatures extends Plan {
  plan_features: {
    enabled: boolean;
    feature_key: FeatureKey;
    feature: { name: string; description: string | null } | null;
  }[];
  plan_limits: { limit_key: PlanUsageRow["limit_key"]; limit_value: number | null }[];
}

export function PlanSubscriptionPanel({
  subscription,
  currentPlan,
  plans,
  usage,
}: {
  subscription: Subscription | null;
  currentPlan: Plan | null;
  plans: PlanWithFeatures[];
  usage: PlanUsageRow[];
}) {
  const [target, setTarget] = React.useState<PlanWithFeatures | null>(null);
  const trialDays = subscription ? daysUntil(subscription.trial_ends_at) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Plan actual</p>
            <p className="font-heading text-xl font-semibold text-foreground">
              {currentPlan?.name ?? "—"}
            </p>
          </div>
          {subscription && (
            <Badge variant={subscription.status === "active" ? "default" : "outline"}>
              {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
            </Badge>
          )}
        </div>

        {subscription?.status === "trial" && trialDays !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {trialDays > 0 ? `Tu prueba termina en ${trialDays} día${trialDays === 1 ? "" : "s"}.` : "Tu prueba terminó."}
          </p>
        )}
        {(subscription?.status === "suspended" || subscription?.status === "expired") && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-3.5" />
            Tu cuenta tiene funciones limitadas. Tu información sigue guardada.
          </p>
        )}

        {currentPlan && (
          <div className="mt-3 text-sm text-muted-foreground">
            {currentPlan.price_monthly_cents === 0 ? (
              "Plan gratuito"
            ) : (
              <>
                {formatPlanPrice(currentPlan).primary} / mes
                {formatPlanPrice(currentPlan).secondary && (
                  <span className="ml-1.5 text-xs">({formatPlanPrice(currentPlan).secondary})</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {usage.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">Uso actual</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {usage.map((row) => {
              const pct = usagePct(row);
              return (
                <div key={row.limit_key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{PLAN_LIMIT_LABELS[row.limit_key]}</span>
                    <span className="font-medium text-foreground">
                      {row.current_usage} / {formatLimitValue(row.limit_key, row.limit_value)}
                    </span>
                  </div>
                  {pct !== null && (
                    <>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-brand",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {pct >= 100 && (
                        <p className="mt-1 text-xs text-destructive">Has alcanzado el límite.</p>
                      )}
                      {pct >= 80 && pct < 100 && (
                        <p className="mt-1 text-xs text-warning-foreground">Estás cerca del límite.</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Planes disponibles</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan?.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border p-4",
                  isCurrent ? "border-brand bg-brand/5" : "border-border bg-card",
                )}
              >
                <p className="font-heading text-base font-semibold text-foreground">{plan.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatPlanPrice(plan).primary}
                  {plan.price_monthly_cents > 0 && (
                    <span className="text-xs font-normal text-muted-foreground"> / mes</span>
                  )}
                </p>
                {formatPlanPrice(plan).secondary && (
                  <p className="text-xs text-muted-foreground">{formatPlanPrice(plan).secondary}</p>
                )}
                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.plan_features
                    .filter((pf) => pf.enabled && pf.feature)
                    .map((pf) => (
                      <li key={pf.feature_key} className="flex items-start gap-1.5 text-xs text-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                        {pf.feature!.name}
                      </li>
                    ))}
                </ul>
                <Button
                  className="mt-4"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent}
                  onClick={() => setTarget(plan)}
                >
                  {isCurrent ? "Plan actual" : "Elegir este plan"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <PlanChangeDialog
        target={target}
        currentPlan={currentPlan}
        usage={usage}
        onOpenChange={(open) => !open && setTarget(null)}
      />
    </div>
  );
}

function PlanChangeDialog({
  target,
  currentPlan,
  usage,
  onOpenChange,
}: {
  target: PlanWithFeatures | null;
  currentPlan: Plan | null;
  usage: PlanUsageRow[];
  onOpenChange: (open: boolean) => void;
}) {
  const isUpgrade = target && currentPlan ? target.price_monthly_cents > currentPlan.price_monthly_cents : true;

  const exceeded = React.useMemo(() => {
    if (!target) return [];
    return usage
      .map((row) => {
        const newLimit = target.plan_limits.find((l) => l.limit_key === row.limit_key)?.limit_value ?? null;
        return { ...row, newLimit };
      })
      .filter((row) => row.newLimit !== null && row.current_usage > row.newLimit);
  }, [target, usage]);

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isUpgrade ? "Mejorar a" : "Cambiar a"} plan {target?.name}
          </DialogTitle>
          <DialogDescription>
            {currentPlan?.name} → {target?.name}
          </DialogDescription>
        </DialogHeader>

        {exceeded.length > 0 && target && (
          <div className="space-y-1.5 rounded-lg bg-warning/10 p-3 text-sm text-warning-foreground">
            {exceeded.map((row) => (
              <p key={row.limit_key}>
                Actualmente tienes {row.current_usage} {PLAN_LIMIT_LABELS[row.limit_key].toLowerCase()}. El
                plan {target.name} permite {row.newLimit}.
              </p>
            ))}
            <p>
              Tus datos no serán eliminados, pero no podrás crear nuevos hasta estar dentro del límite.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              toast.info("Funcionalidad de pago próximamente", {
                description: "Muy pronto podrás cambiar de plan directamente desde aquí.",
              });
              onOpenChange(false);
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
