import type { BusinessType, FeatureKey } from "@/types/database";

/**
 * "on"/"off" = fijo, no se puede tocar desde Configuración (ej. un
 * restaurante siempre tiene Productos, una peluquería siempre tiene
 * Servicios porque Agenda depende de eso). "optional-*" = el dueño puede
 * prender/apagar, el sufijo es solo el valor por defecto.
 */
export type FeatureMode = "on" | "off" | "optional-on" | "optional-off";

/**
 * Features que pueden variar por rubro. Para los rubros con vertical definido
 * solo Productos y Servicios son opcionales; el resto vienen fijas en "on" y
 * por lo tanto no se listan ni se tocan. El rubro "general" las abre todas
 * — ver GENERAL_MODE.
 */
export const TOGGLEABLE_FEATURES: FeatureKey[] = [
  "products",
  "services",
  "inventory",
  "catalog",
  "orders",
  "delivery",
  "appointments",
  "work_orders",
  "recipes",
  "pets",
  "laundry_orders",
  "food_service",
  "gallery",
  "crm",
  "marketing",
];

/**
 * Rubro "Varios": todo está disponible y el dueño arma su propio negocio.
 * Encendidos por defecto los módulos que casi cualquier negocio usa; apagados
 * los que son propios de un vertical, para no abrumar la navegación el primer
 * día. Nada acá es definitivo: todo se prende y se apaga en Configuración.
 */
const GENERAL_MODE: Partial<Record<FeatureKey, FeatureMode>> = {
  products: "optional-on",
  services: "optional-on",
  inventory: "optional-on",
  catalog: "optional-on",
  orders: "optional-on",
  delivery: "optional-off",
  appointments: "optional-off",
  work_orders: "optional-off",
  recipes: "optional-off",
  pets: "optional-off",
  laundry_orders: "optional-off",
  food_service: "optional-off",
  gallery: "optional-off",
  crm: "optional-off",
  marketing: "optional-off",
};

type VerticalBusinessType = Exclude<BusinessType, "general">;

const SERVICES_MODE: Record<VerticalBusinessType, FeatureMode> = {
  // Fijos: Agenda depende de que existan servicios con duración.
  barbershop: "on",
  pet_shop: "on",
  workshop: "on",
  moto_wash: "on",
  // Opcionales: no es lo habitual del rubro, pero pasa — una panadería que
  // cobra tortas por encargo, una boutique con arreglos de costura, una
  // lavandería con planchado a domicilio.
  food: "optional-off",
  bakery: "optional-off",
  produce: "optional-off",
  boutique: "optional-off",
  laundry: "optional-off",
};

const PRODUCTS_MODE: Record<VerticalBusinessType, FeatureMode> = {
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
  if (businessType === "general") return GENERAL_MODE[feature] ?? "on";
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
  inventory: { name: "Inventario", hint: "Control de existencias, entradas, salidas y ajustes." },
  catalog: { name: "Catálogo público", hint: "Tu tienda en línea, con enlace para compartir." },
  orders: { name: "Pedidos", hint: "Pedidos que entran desde el catálogo público." },
  delivery: { name: "Delivery", hint: "Entregas a domicilio con zonas y repartidores." },
  appointments: { name: "Agenda", hint: "Citas por profesional, con duración y recordatorios." },
  work_orders: { name: "Órdenes de trabajo", hint: "Trabajos sobre vehículos o equipos, con repuestos." },
  recipes: { name: "Recetas y producción", hint: "Recetas, producción diaria y merma." },
  pets: { name: "Mascotas", hint: "Ficha de cada mascota, vacunas e historial." },
  laundry_orders: { name: "Órdenes de lavado", hint: "Órdenes de lavandería con estado de cada prenda." },
  food_service: { name: "Mesas y cocina", hint: "Pedidos en local, mesas y pantalla de cocina." },
  gallery: { name: "Galería de trabajos", hint: "Fotos de trabajos realizados para mostrar a tus clientes." },
  crm: { name: "CRM", hint: "Seguimiento de oportunidades y clientes potenciales." },
  marketing: { name: "Marketing", hint: "Campañas y promociones a tus clientes." },
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
