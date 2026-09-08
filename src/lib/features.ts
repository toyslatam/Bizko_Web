import type { BusinessType, FeatureKey } from "@/types/database";

/**
 * "on"/"off" = fijo, no se puede tocar desde Configuración (ej. un
 * restaurante siempre tiene Productos, una peluquería siempre tiene
 * Servicios porque Agenda depende de eso). "optional-*" = el dueño puede
 * prender/apagar, el sufijo es solo el valor por defecto.
 */
export type FeatureMode = "on" | "off" | "optional-on" | "optional-off";

/** Features que pueden variar por rubro — hoy solo Productos y Servicios. */
export const TOGGLEABLE_FEATURES: FeatureKey[] = ["products", "services"];

const SERVICES_MODE: Record<BusinessType, FeatureMode> = {
  barbershop: "on",
  pet_shop: "on",
  workshop: "on",
  moto_wash: "on",
  food: "off",
  bakery: "off",
  produce: "off",
  boutique: "off",
  laundry: "off",
};

const PRODUCTS_MODE: Record<BusinessType, FeatureMode> = {
  barbershop: "optional-off",
  workshop: "optional-off",
  moto_wash: "optional-off",
  laundry: "optional-off",
  pet_shop: "on",
  food: "on",
  bakery: "on",
  produce: "on",
  boutique: "on",
};

function modeFor(feature: FeatureKey, businessType: BusinessType): FeatureMode {
  if (feature === "services") return SERVICES_MODE[businessType];
  if (feature === "products") return PRODUCTS_MODE[businessType];
  return "on";
}

const FEATURE_TOGGLE_LABELS: Partial<Record<FeatureKey, { name: string; hint: string }>> = {
  products: {
    name: "Productos",
    hint: "Actívalo si además de tus servicios vendes productos (ej. shampoo, esmaltes, repuestos).",
  },
  services: {
    name: "Servicios",
    hint: "Catálogo de servicios que ofreces (con precio y duración).",
  },
};

export interface ToggleableFeature {
  feature: FeatureKey;
  name: string;
  hint: string;
  defaultEnabled: boolean;
}

/** Solo las features que este rubro puede prender/apagar — las fijas no se listan. */
export function getToggleableFeaturesForBusiness(businessType: BusinessType): ToggleableFeature[] {
  return TOGGLEABLE_FEATURES.filter((feature) => !isFeatureFixed(feature, businessType)).map((feature) => ({
    feature,
    name: FEATURE_TOGGLE_LABELS[feature]?.name ?? feature,
    hint: FEATURE_TOGGLE_LABELS[feature]?.hint ?? "",
    defaultEnabled: defaultFeatureEnabled(feature, businessType),
  }));
}

export function isFeatureFixed(feature: FeatureKey, businessType: BusinessType): boolean {
  const mode = modeFor(feature, businessType);
  return mode === "on" || mode === "off";
}

export function defaultFeatureEnabled(feature: FeatureKey, businessType: BusinessType): boolean {
  const mode = modeFor(feature, businessType);
  return mode === "on" || mode === "optional-on";
}

/**
 * Combina lo que el plan permite (planFeatures) con la regla del rubro y lo
 * que el dueño haya elegido manualmente (toggles). El plan sigue siendo el
 * techo: si el plan no incluye "products", nunca aparece aunque el rubro y
 * el toggle digan que sí.
 */
export function applyBusinessFeatureRules(
  planFeatures: Set<FeatureKey>,
  businessType: BusinessType,
  toggles: Map<string, boolean>,
): Set<FeatureKey> {
  const result = new Set(planFeatures);

  for (const feature of TOGGLEABLE_FEATURES) {
    if (!planFeatures.has(feature)) continue;

    const mode = modeFor(feature, businessType);
    if (mode === "off") {
      result.delete(feature);
      continue;
    }
    if (mode === "on") continue;

    const override = toggles.get(feature);
    const enabled = override ?? defaultFeatureEnabled(feature, businessType);
    if (enabled) result.add(feature);
    else result.delete(feature);
  }

  return result;
}
