import type { BusinessType, FeatureKey } from "@/types/database";
import {
  ChefHat,
  Bike,
  CalendarClock,
  Shirt,
  PawPrint,
  Wrench as WrenchIcon,
  UtensilsCrossed,
  Scissors,
  type LucideIcon,
} from "lucide-react";

/**
 * Registro de verticales de negocio. Cada entrada describe un módulo en
 * /src/modules/<slug>. Desde la Fase 9, `navItems` define qué rutas
 * específicas del vertical se agregan a la navegación del CORE — ver
 * getNavForBusinessType() en src/lib/nav-config.ts.
 *
 * Mantener esta lista sincronizada con las carpetas en /src/modules.
 */
export interface VerticalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Sin feature = siempre visible (los módulos de vertical no están gateados por plan todavía). */
  feature?: FeatureKey;
}

export interface BusinessModuleConfig {
  type: BusinessType;
  slug: string;
  emoji: string;
  name: string;
  description: string;
  /** Funcionalidades específicas de este vertical, además del CORE. */
  plannedFeatures: string[];
  /** Rutas propias del vertical, agregadas a la navegación (ver §18 Fase 9). */
  navItems: VerticalNavItem[];
}

export const BUSINESS_MODULES: BusinessModuleConfig[] = [
  {
    type: "bakery",
    slug: "bakery",
    emoji: "🥖",
    name: "Panadería",
    description: "Recetas, producción diaria y punto de venta.",
    plannedFeatures: ["Recetas y producción", "Horneadas del día", "Merma"],
    navItems: [{ label: "Recetas", href: "/produccion", icon: ChefHat }],
  },
  {
    type: "produce",
    slug: "produce",
    emoji: "🥬",
    name: "Frutas y verduras",
    description: "Productos por peso y disponibilidad del día.",
    plannedFeatures: ["Venta por peso", "Disponibilidad diaria", "Proveedores"],
    navItems: [],
  },
  {
    type: "moto_wash",
    slug: "moto-wash",
    emoji: "🏍️",
    name: "Lavadero (motos y vehículos)",
    description: "Vehículos registrados, servicios de lavado y turnos por bahía.",
    plannedFeatures: ["Ficha de vehículo", "Combos de lavado", "Historial por placa", "Turnos por bahía de lavado"],
    navItems: [
      { label: "Vehículos", href: "/vehiculos", icon: Bike },
      { label: "Agenda", href: "/agenda", icon: CalendarClock },
      { label: "Profesionales", href: "/profesionales", icon: Scissors },
    ],
  },
  {
    type: "barbershop",
    slug: "barbershop",
    emoji: "💈",
    name: "Peluquería / Barbería / Salón de belleza",
    description: "Agenda con profesionales, servicios con duración y comisiones.",
    plannedFeatures: ["Agenda de citas", "Profesionales y comisiones", "Reserva desde el catálogo público", "Recordatorios"],
    navItems: [
      { label: "Agenda", href: "/agenda", icon: CalendarClock },
      { label: "Profesionales", href: "/profesionales", icon: Scissors },
    ],
  },
  {
    type: "laundry",
    slug: "laundry",
    emoji: "🧺",
    name: "Lavandería",
    description: "Órdenes de lavado con seguimiento de estado.",
    plannedFeatures: ["Órdenes de lavado", "Estados de prenda", "Notificación de entrega"],
    navItems: [{ label: "Órdenes de lavado", href: "/lavanderia", icon: Shirt }],
  },
  {
    type: "pet_shop",
    slug: "pet-shop",
    emoji: "🐶",
    name: "Tienda de mascotas",
    description: "Mascotas asociadas a cada cliente, con agenda de peluquería canina.",
    plannedFeatures: ["Ficha de mascota", "Recordatorio de vacunas", "Peluquería canina"],
    navItems: [
      { label: "Mascotas", href: "/mascotas", icon: PawPrint },
      { label: "Agenda", href: "/agenda", icon: CalendarClock },
      { label: "Profesionales", href: "/profesionales", icon: Scissors },
    ],
  },
  {
    type: "workshop",
    slug: "workshop",
    emoji: "🔧",
    name: "Taller",
    description: "Vehículos, órdenes de trabajo y turnos para dejar el vehículo.",
    plannedFeatures: ["Ficha de vehículo", "Órdenes de trabajo", "Repuestos usados", "Turnos por mecánico"],
    navItems: [
      { label: "Vehículos", href: "/vehiculos", icon: Bike },
      { label: "Órdenes de trabajo", href: "/ordenes-trabajo", icon: WrenchIcon },
      { label: "Agenda", href: "/agenda", icon: CalendarClock },
      { label: "Profesionales", href: "/profesionales", icon: Scissors },
    ],
  },
  {
    type: "food",
    slug: "food",
    emoji: "🍗",
    name: "Restaurante y comida rápida",
    description: "Menú con modificadores, mesas y cocina — para restaurantes, comida rápida, cafeterías, pizzerías, hamburgueserías y panaderías-cafetería.",
    plannedFeatures: ["Menú con modificadores y combos", "Mesas y pedidos en local", "Cocina (KDS)", "Reportes de restaurante"],
    navItems: [
      { label: "Cocina", href: "/cocina", icon: ChefHat },
      { label: "Mesas", href: "/mesas", icon: UtensilsCrossed },
    ],
  },
  {
    type: "boutique",
    slug: "boutique",
    emoji: "👗",
    name: "Boutique / tienda de ropa",
    description: "Variantes por talla y color.",
    plannedFeatures: ["Tallas y colores", "Variantes de producto", "Colecciones"],
    navItems: [],
  },
];

export function getBusinessModule(type: BusinessType): BusinessModuleConfig {
  const businessModule = BUSINESS_MODULES.find((m) => m.type === type);
  if (!businessModule) throw new Error(`Módulo de negocio no encontrado: ${type}`);
  return businessModule;
}
