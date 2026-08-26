"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_LIMIT_LABELS } from "@/lib/plans";
import { updatePlanAction, togglePlanFeatureAction, updatePlanLimitsAction } from "@/app/admin/planes/actions";
import type { FeatureDef, Plan, PlanFeature, PlanLimit, PlanLimitKey } from "@/types/database";

const LIMIT_KEYS = Object.keys(PLAN_LIMIT_LABELS) as PlanLimitKey[];

interface PlanEditorCardProps {
  plan: Plan & {
    plan_features: Pick<PlanFeature, "feature_key" | "enabled">[];
    plan_limits: Pick<PlanLimit, "limit_key" | "limit_value">[];
  };
  allFeatures: FeatureDef[];
}

export function PlanEditorCard({ plan, allFeatures }: PlanEditorCardProps) {
  const [values, setValues] = React.useState({
    name: plan.name,
    description: plan.description,
    priceMonthly: String(plan.price_monthly_cents / 100),
    priceYearly: String(plan.price_yearly_cents / 100),
    isActive: plan.is_active,
    isRecommended: plan.is_recommended,
  });
  const [savingPlan, setSavingPlan] = React.useState(false);

  const [featureState, setFeatureState] = React.useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const pf of plan.plan_features) map[pf.feature_key] = pf.enabled;
    return map;
  });
  const [savingFeature, setSavingFeature] = React.useState<string | null>(null);

  const [limitValues, setLimitValues] = React.useState<Record<PlanLimitKey, string>>(() => {
    const map = {} as Record<PlanLimitKey, string>;
    for (const key of LIMIT_KEYS) {
      const row = plan.plan_limits.find((l) => l.limit_key === key);
      map[key] = row?.limit_value === null || row?.limit_value === undefined ? "" : String(row.limit_value);
    }
    return map;
  });
  const [limitUnlimited, setLimitUnlimited] = React.useState<Record<PlanLimitKey, boolean>>(() => {
    const map = {} as Record<PlanLimitKey, boolean>;
    for (const key of LIMIT_KEYS) {
      const row = plan.plan_limits.find((l) => l.limit_key === key);
      map[key] = !row || row.limit_value === null;
    }
    return map;
  });
  const [savingLimits, setSavingLimits] = React.useState(false);

  function patch<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    const result = await updatePlanAction(plan.id, {
      name: values.name,
      description: values.description,
      priceMonthlyCents: Math.round(Number(values.priceMonthly || 0) * 100),
      priceYearlyCents: Math.round(Number(values.priceYearly || 0) * 100),
      isActive: values.isActive,
      isRecommended: values.isRecommended,
    });
    setSavingPlan(false);

    if ("error" in result) {
      toast.error("No pudimos guardar el plan", { description: result.error });
      return;
    }
    toast.success(`Plan "${values.name}" actualizado.`);
  }

  async function handleToggleFeature(featureKey: string, enabled: boolean) {
    setFeatureState((s) => ({ ...s, [featureKey]: enabled }));
    setSavingFeature(featureKey);
    const result = await togglePlanFeatureAction(plan.id, featureKey as FeatureDef["key"], enabled);
    setSavingFeature(null);

    if ("error" in result) {
      setFeatureState((s) => ({ ...s, [featureKey]: !enabled }));
      toast.error("No pudimos actualizar la función", { description: result.error });
    }
  }

  async function handleSaveLimits() {
    setSavingLimits(true);
    const limits = LIMIT_KEYS.map((key) => ({
      limitKey: key,
      value: limitUnlimited[key] ? null : limitValues[key] === "" ? 0 : Number(limitValues[key]),
    }));
    const result = await updatePlanLimitsAction(plan.id, limits);
    setSavingLimits(false);

    if ("error" in result) {
      toast.error("No pudimos guardar los límites", { description: result.error });
      return;
    }
    toast.success("Límites actualizados.");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{plan.name}</CardTitle>
          <Badge variant={values.isActive ? "default" : "secondary"}>
            {values.isActive ? "Activo" : "Inactivo"}
          </Badge>
          {values.isRecommended && <Badge variant="outline">Recomendado</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSavePlan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${plan.id}`}>Nombre</Label>
              <Input id={`name-${plan.id}`} value={values.name} onChange={(e) => patch("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`slug-${plan.id}`}>Código</Label>
              <Input id={`slug-${plan.id}`} value={plan.code} disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`description-${plan.id}`}>Descripción</Label>
              <Textarea
                id={`description-${plan.id}`}
                rows={2}
                value={values.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`price-monthly-${plan.id}`}>Precio mensual (COP)</Label>
              <Input
                id={`price-monthly-${plan.id}`}
                type="number"
                min={0}
                value={values.priceMonthly}
                onChange={(e) => patch("priceMonthly", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`price-yearly-${plan.id}`}>Precio anual (COP)</Label>
              <Input
                id={`price-yearly-${plan.id}`}
                type="number"
                min={0}
                value={values.priceYearly}
                onChange={(e) => patch("priceYearly", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Switch checked={values.isActive} onCheckedChange={(v) => patch("isActive", v)} />
              Plan activo
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Switch checked={values.isRecommended} onCheckedChange={(v) => patch("isRecommended", v)} />
              Plan recomendado
            </label>
          </div>

          <Button type="submit" disabled={savingPlan}>
            {savingPlan ? "Guardando..." : "Guardar"}
          </Button>
        </form>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Funciones</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {allFeatures.map((feature) => (
              <label
                key={feature.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="text-foreground">{feature.name}</span>
                <Switch
                  checked={featureState[feature.key] ?? false}
                  disabled={savingFeature === feature.key}
                  onCheckedChange={(v) => handleToggleFeature(feature.key, v)}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Límites</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {LIMIT_KEYS.map((key) => (
              <div key={key} className="space-y-1.5 rounded-lg border border-border p-3">
                <Label htmlFor={`limit-${plan.id}-${key}`}>{PLAN_LIMIT_LABELS[key]}</Label>
                <Input
                  id={`limit-${plan.id}-${key}`}
                  type="number"
                  min={0}
                  disabled={limitUnlimited[key]}
                  value={limitUnlimited[key] ? "" : limitValues[key]}
                  placeholder={limitUnlimited[key] ? "Ilimitado" : undefined}
                  onChange={(e) => setLimitValues((v) => ({ ...v, [key]: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    size="sm"
                    checked={limitUnlimited[key]}
                    onCheckedChange={(v) => setLimitUnlimited((s) => ({ ...s, [key]: v }))}
                  />
                  Ilimitado
                </label>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-3" disabled={savingLimits} onClick={handleSaveLimits}>
            {savingLimits ? "Guardando..." : "Guardar límites"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
