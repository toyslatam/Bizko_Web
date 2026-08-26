import type { CashMovementType, ExpenseStatus } from "@/types/database";

export const CASH_MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  adjustment: "Ajuste",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  registered: "Registrado",
  voided: "Anulado",
};

export const MANUAL_INCOME_REASONS = [
  "Aporte del propietario",
  "Ingreso extraordinario",
  "Devolución recibida",
  "Otro",
] as const;

export const MANUAL_EXPENSE_REASONS = [
  "Retiro del propietario",
  "Traslado de dinero",
  "Ajuste",
  "Otro",
] as const;
