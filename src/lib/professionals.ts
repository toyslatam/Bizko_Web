export const WORK_DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/** Recorta segundos de un time de Postgres ("09:00:00" -> "09:00"). */
export function formatTimeShort(time: string): string {
  return time.slice(0, 5);
}

/** Resume días de trabajo en rangos compactos, ej. [1,2,3,4,5,6] -> "Lun-Sáb". */
export function summarizeWorkDays(days: number[]): string {
  if (days.length === 0) return "Sin días asignados";
  if (days.length === 7) return "Todos los días";

  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? WORK_DAY_LABELS[start] : `${WORK_DAY_LABELS[start]}-${WORK_DAY_LABELS[prev]}`);
    start = current;
    prev = current;
  }

  return ranges.join(", ");
}

export function summarizeWorkSchedule(days: number[], startTime: string, endTime: string): string {
  return `${summarizeWorkDays(days)} · ${formatTimeShort(startTime)}-${formatTimeShort(endTime)}`;
}
