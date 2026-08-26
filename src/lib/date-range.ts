export type PeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  this_month: "Este mes",
  last_month: "Mes anterior",
  this_year: "Este año",
  custom: "Personalizado",
};

export interface DateRange {
  /** Instante UTC inicial (inclusive), listo para `.gte()` o pasar a una RPC. */
  start: Date;
  /** Instante UTC final (exclusivo), listo para `.lt()` o pasar a una RPC. */
  end: Date;
  label: string;
}

/**
 * Offset (en minutos) tal que `instant + offset` reproduce el mismo reloj de
 * pared que en `timeZone`. Aproximación estándar de dos pasos (no itera para
 * el borde exacto de un cambio de horario de verano) — suficiente para
 * reportes de negocio, no para programar eventos al segundo.
 */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - instant.getTime()) / 60000;
}

/** Convierte una fecha/hora "de pared" en `timeZone` (ej. medianoche local) al instante UTC real. */
function zonedTimeToUtc(y: number, m: number, d: number, h: number, mi: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** Año/mes/día locales (según `timeZone`) del instante dado. */
function zonedYmd(instant: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function startOfLocalDay(instant: Date, timeZone: string): Date {
  const { y, m, d } = zonedYmd(instant, timeZone);
  return zonedTimeToUtc(y, m, d, 0, 0, timeZone);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function getPeriodRange(
  preset: PeriodPreset,
  timeZone: string,
  custom?: { start: Date; end: Date },
  now: Date = new Date(),
): DateRange {
  const todayStart = startOfLocalDay(now, timeZone);
  const label = PERIOD_PRESET_LABELS[preset];

  switch (preset) {
    case "today":
      return { start: todayStart, end: addDays(todayStart, 1), label };
    case "yesterday":
      return { start: addDays(todayStart, -1), end: todayStart, label };
    case "7d":
      return { start: addDays(todayStart, -6), end: addDays(todayStart, 1), label };
    case "30d":
      return { start: addDays(todayStart, -29), end: addDays(todayStart, 1), label };
    case "this_month": {
      const { y, m } = zonedYmd(now, timeZone);
      const start = zonedTimeToUtc(y, m, 1, 0, 0, timeZone);
      const end = zonedTimeToUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1, 0, 0, timeZone);
      return { start, end, label };
    }
    case "last_month": {
      const { y, m } = zonedYmd(now, timeZone);
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const start = zonedTimeToUtc(prevY, prevM, 1, 0, 0, timeZone);
      const end = zonedTimeToUtc(y, m, 1, 0, 0, timeZone);
      return { start, end, label };
    }
    case "this_year": {
      const { y } = zonedYmd(now, timeZone);
      const start = zonedTimeToUtc(y, 1, 1, 0, 0, timeZone);
      const end = zonedTimeToUtc(y + 1, 1, 1, 0, 0, timeZone);
      return { start, end, label };
    }
    case "custom":
      if (!custom) throw new Error("El periodo personalizado requiere start/end.");
      return { start: custom.start, end: addDays(custom.end, 1), label };
  }
}

/** Mismo largo de periodo, inmediatamente anterior — para el comparativo "vs. período anterior". */
export function getPreviousPeriodRange(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - durationMs),
    end: new Date(range.start.getTime()),
    label: "Período anterior",
  };
}

export function deltaPct(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function parsePeriodSearchParams(
  searchParams: Record<string, string | undefined>,
): { preset: PeriodPreset; custom?: { start: Date; end: Date } } {
  const preset = (searchParams.period as PeriodPreset) || "today";
  if (preset === "custom" && searchParams.start && searchParams.end) {
    return { preset, custom: { start: new Date(searchParams.start), end: new Date(searchParams.end) } };
  }
  if (!(preset in PERIOD_PRESET_LABELS)) return { preset: "today" };
  return { preset };
}
