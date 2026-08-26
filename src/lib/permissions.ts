import type { CompanyRole } from "@/types/database";

/**
 * Permisos por rol dentro de una empresa. OWNER tiene acceso total a su
 * negocio, MANAGER opera el día a día, EMPLOYEE tiene acceso limitado.
 *
 * El SUPER ADMIN de la plataforma es un concepto aparte (tabla
 * `platform_admins`, no un rol de empresa) — se comprueba con
 * `isPlatformAdmin`, no con `can()`. Un platform admin puede leer/editar
 * cualquier empresa gracias a las políticas RLS, independientemente de
 * estos permisos de UI.
 */
export type Permission =
  | "ventas.crear"
  | "ventas.anular"
  | "ventas.editar_precio"
  | "pedidos.gestionar"
  | "delivery.gestionar"
  | "delivery.configurar"
  | "catalogo.editar"
  | "clientes.editar"
  | "inventario.editar"
  | "caja.registrar"
  | "caja.administrar"
  | "gastos.anular"
  | "finanzas.ver"
  | "finanzas.editar"
  | "reportes.ver"
  | "configuracion.editar"
  | "equipo.gestionar";

const ROLE_PERMISSIONS: Record<CompanyRole, Permission[]> = {
  employee: ["ventas.crear", "pedidos.gestionar", "delivery.gestionar", "clientes.editar", "caja.registrar"],
  manager: [
    "ventas.crear",
    "ventas.anular",
    "ventas.editar_precio",
    "pedidos.gestionar",
    "delivery.gestionar",
    "delivery.configurar",
    "catalogo.editar",
    "clientes.editar",
    "inventario.editar",
    "caja.registrar",
    "caja.administrar",
    "gastos.anular",
    "finanzas.ver",
    "reportes.ver",
  ],
  owner: [
    "ventas.crear",
    "ventas.anular",
    "ventas.editar_precio",
    "pedidos.gestionar",
    "delivery.gestionar",
    "delivery.configurar",
    "catalogo.editar",
    "clientes.editar",
    "inventario.editar",
    "caja.registrar",
    "caja.administrar",
    "gastos.anular",
    "finanzas.ver",
    "finanzas.editar",
    "reportes.ver",
    "configuracion.editar",
    "equipo.gestionar",
  ],
};

export function can(role: CompanyRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Dueño",
  manager: "Gerente",
  employee: "Empleado",
};

export const MEMBER_STATUS_LABELS = {
  active: "Activo",
  invited: "Invitación pendiente",
  inactive: "Inactivo",
} as const;
