import type { AutomationActionType, AutomationStatus, AutomationTrigger } from "@/types/database";

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  new_order: "Nuevo pedido",
  order_status_changed: "Cambio de estado de pedido",
  sale_created: "Venta registrada",
  low_stock: "Stock bajo",
  customer_created: "Cliente nuevo",
  appointment_created: "Cita agendada",
  appointment_upcoming: "Cita próxima",
  expense_created: "Gasto registrado",
  daily_schedule: "Todos los días",
  weekly_schedule: "Cada semana",
};

export const AUTOMATION_ACTION_LABELS: Record<AutomationActionType, string> = {
  notification: "Enviarme una notificación",
  email: "Enviar un correo",
  webhook: "Llamar un webhook (n8n)",
  create_task: "Crear una tarea",
  ai_summary: "Generar un resumen con IA",
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  active: "Activa",
  paused: "Pausada",
  error: "Necesita atención",
};

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  trigger_type: AutomationTrigger;
  condition: Record<string, unknown>;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "stock_bajo",
    name: "Stock bajo",
    description: "Cuando un producto tenga stock bajo → enviar alerta.",
    trigger_type: "low_stock",
    condition: { field: "current_stock", operator: "<=", value_field: "minimum_stock" },
    action_type: "notification",
    action_config: { message: "Un producto llegó a su stock mínimo." },
  },
  {
    key: "nuevo_pedido",
    name: "Nuevo pedido",
    description: "Cuando llegue un pedido → enviar notificación.",
    trigger_type: "new_order",
    condition: {},
    action_type: "notification",
    action_config: { message: "Tienes un nuevo pedido por confirmar." },
  },
  {
    key: "resumen_semanal",
    name: "Resumen semanal",
    description: "Cada lunes → generar resumen → enviar al propietario.",
    trigger_type: "weekly_schedule",
    condition: { day_of_week: "monday" },
    action_type: "ai_summary",
    action_config: { message: "Resumen semanal de ventas para el propietario." },
  },
  {
    key: "pedido_entregado",
    name: "Pedido entregado",
    description: "Cuando un pedido sea entregado → registrar evento → preparar confirmación.",
    trigger_type: "order_status_changed",
    condition: { field: "status", operator: "=", value: "delivered" },
    action_type: "notification",
    action_config: { message: "Un pedido fue marcado como entregado." },
  },
];
