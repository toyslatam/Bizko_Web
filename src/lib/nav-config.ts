import type { Permission } from "@/lib/permissions";
import type { BusinessType, FeatureKey } from "@/types/database";
import { getBusinessModule } from "@/modules/registry";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Wrench,
  Tags,
  Users,
  Boxes,
  Bike,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavLeaf {
  label: string;
  href: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  permission?: Permission;
}

export interface NavGroup {
  label: string | null;
  items: NavLeaf[];
}

/**
 * Navegación del CORE. Se muestra igual para todos los negocios; en fases
 * futuras se insertan aquí los items específicos de cada vertical
 * (ver /src/modules/registry.ts) y se filtra por plan y permisos.
 */
export const CORE_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Inicio", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operación",
    items: [
      {
        label: "Ventas",
        href: "/ventas",
        icon: ShoppingCart,
        feature: "sales",
        permission: "ventas.crear",
      },
      {
        label: "Pedidos",
        href: "/pedidos",
        icon: ClipboardList,
        feature: "orders",
        permission: "pedidos.gestionar",
      },
      {
        label: "Delivery",
        href: "/delivery",
        icon: Bike,
        feature: "delivery",
        permission: "delivery.gestionar",
      },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        label: "Productos",
        href: "/productos",
        icon: Package,
        feature: "products",
        permission: "catalogo.editar",
      },
      {
        label: "Servicios",
        href: "/servicios",
        icon: Wrench,
        feature: "services",
        permission: "catalogo.editar",
      },
      {
        label: "Categorías",
        href: "/categorias",
        icon: Tags,
        feature: "products",
        permission: "catalogo.editar",
      },
    ],
  },
  {
    label: null,
    items: [
      {
        label: "Clientes",
        href: "/clientes",
        icon: Users,
        feature: "customers",
        permission: "clientes.editar",
      },
      {
        label: "Inventario",
        href: "/inventario",
        icon: Boxes,
        feature: "inventory",
        permission: "inventario.editar",
      },
    ],
  },
  {
    label: "Finanzas",
    items: [
      {
        label: "Caja",
        href: "/caja",
        icon: Wallet,
        feature: "cash",
        permission: "finanzas.ver",
      },
      {
        label: "Gastos",
        href: "/gastos",
        icon: Receipt,
        feature: "cash",
        permission: "finanzas.ver",
      },
    ],
  },
  {
    label: null,
    items: [
      {
        label: "Reportes",
        href: "/reportes",
        icon: BarChart3,
        feature: "reports",
        permission: "reportes.ver",
      },
      {
        label: "Asistente IA",
        href: "/asistente-ia",
        icon: Sparkles,
        feature: "ai",
      },
      {
        label: "Automatizaciones",
        href: "/automatizaciones",
        icon: Zap,
        feature: "automation",
      },
      {
        label: "Configuración",
        href: "/configuracion",
        icon: Settings,
        permission: "configuracion.editar",
      },
    ],
  },
];

/**
 * CORE + VERTICAL: inserta las rutas propias del tipo de negocio justo
 * después de "Clientes" (ver Fase 9 §18 — ej. Barbería agrega "Agenda" ahí),
 * y oculta los items cuya `feature` no esté habilitada en el plan de la
 * empresa (Fase 11 §6 — nunca se filtra por nombre de plan, solo por
 * feature). No muta CORE_NAV; construye una copia para cada empresa.
 */
export function getNavForBusinessType(
  businessType: BusinessType,
  enabledFeatures: Set<FeatureKey>,
): NavGroup[] {
  const verticalItems = getBusinessModule(businessType).navItems;

  return CORE_NAV.map((group) => {
    const items =
      group.label === null && group.items.some((i) => i.href === "/clientes")
        ? [...group.items, ...verticalItems]
        : group.items;
    return {
      ...group,
      items: items.filter((item) => !item.feature || enabledFeatures.has(item.feature)),
    };
  }).filter((group) => group.items.length > 0);
}

/** Items priorizados para la barra de navegación inferior en móvil. */
export const MOBILE_PRIMARY_HREFS = [
  "/dashboard",
  "/ventas",
  "/pedidos",
  "/clientes",
];
