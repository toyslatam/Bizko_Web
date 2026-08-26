import { getPeriodRange, parsePeriodSearchParams, type DateRange } from "@/lib/date-range";

export type ReportSearchParams = { period?: string; start?: string; end?: string };

/** Resuelve los searchParams (?period=, ?start=, ?end=) al rango UTC real, en el timezone de la empresa. */
export function resolveReportPeriod(searchParams: ReportSearchParams, timeZone: string): DateRange {
  const { preset, custom } = parsePeriodSearchParams(searchParams);
  return getPeriodRange(preset, timeZone, custom);
}
