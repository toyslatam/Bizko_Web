export const ADMIN_ACTION_LABELS: Record<string, string> = {
  COMPANY_CREATED: "Empresa creada",
  USER_CREATED: "Usuario creado",
  SUBSCRIPTION_CREATED: "Suscripción creada",
  PLAN_CHANGED: "Plan cambiado",
  TRIAL_STARTED: "Prueba iniciada",
  TRIAL_EXTENDED: "Prueba extendida",
  TRIAL_ENDED: "Prueba finalizada",
  COMPANY_SUSPENDED: "Empresa suspendida",
  COMPANY_REACTIVATED: "Empresa reactivada",
  LIMIT_CHANGED: "Límite modificado",
  FEATURE_TOGGLED: "Función modificada",
};

export function adminActionLabel(action: string): string {
  return ADMIN_ACTION_LABELS[action] ?? action;
}

export const SUSPEND_REASONS = [
  { value: "falta_pago", label: "Falta de pago" },
  { value: "incumplimiento", label: "Incumplimiento" },
  { value: "solicitud_cliente", label: "Solicitud del cliente" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "otro", label: "Otro" },
] as const;
