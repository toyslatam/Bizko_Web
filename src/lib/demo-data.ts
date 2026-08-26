/**
 * Datos de demostración para pantallas del CORE que todavía no tienen datos
 * reales de Supabase (pedidos, inventario, caja). Deliberadamente separado
 * de /src/lib/supabase — nada de la arquitectura real depende de este archivo.
 */

// Usado en la vista de catálogo público de ejemplo (/store/[slug]) hasta que
// exista lookup real por slug.
export const demoCompany = {
  name: "Panadería El Trigal",
  ownerFirstName: "Sofía",
  businessType: "bakery" as const,
};

export const demoQuickActions = [
  { label: "Nueva venta", href: "/ventas/nuevo", icon: "sale" as const },
  { label: "Nuevo pedido", href: "/pedidos", icon: "order" as const },
  { label: "Nuevo producto", href: "/productos", icon: "product" as const },
  { label: "Nuevo cliente", href: "/clientes", icon: "customer" as const },
];

// Pedidos todavía no existe (fase futura) — este item del dashboard sigue en
// demo hasta entonces. Inventario y caja ya son reales, se arman en
// src/app/(app)/dashboard/page.tsx.
export const demoAttention = [
  {
    id: "pedidos-demo",
    title: "6 pedidos pendientes por confirmar",
    description: "Llevan más de 1 hora esperando respuesta.",
    href: "/pedidos",
    tone: "warning" as const,
  },
];
