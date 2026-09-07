/** Utilidades de fechas para la Agenda — sin date-fns (no está en package.json), solo Date nativo en UTC. */

export type AgendaView = "day" | "week" | "month";

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function shiftDate(date: string, days: number): string {
  const d = parseISODate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function shiftMonth(date: string, months: number): string {
  const d = parseISODate(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISODate(d);
}

/** Semana de lunes a domingo. */
export function startOfWeek(date: string): string {
  const d = parseISODate(date);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return toISODate(d);
}

export function startOfMonth(date: string): string {
  const d = parseISODate(date);
  d.setUTCDate(1);
  return toISODate(d);
}

export function endOfMonth(date: string): string {
  const d = parseISODate(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return toISODate(d);
}

export function weekDays(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(startDate, i));
}

/** Cuadrícula completa (semanas de lunes a domingo) que cubre el mes de `date`. */
export function monthGridDays(date: string): string[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = shiftDate(startOfWeek(monthEnd), 6);

  const days: string[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return days;
}

export function isSameMonth(date: string, referenceDate: string): boolean {
  return date.slice(0, 7) === referenceDate.slice(0, 7);
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAY_LABELS_LONG = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
export const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function formatDayLabel(date: string): string {
  const d = parseISODate(date);
  const weekday = WEEKDAY_LABELS_LONG[(d.getUTCDay() + 6) % 7];
  return `${weekday} ${d.getUTCDate()} de ${MONTH_LABELS[d.getUTCMonth()]}`;
}

export function formatMonthLabel(date: string): string {
  const d = parseISODate(date);
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
