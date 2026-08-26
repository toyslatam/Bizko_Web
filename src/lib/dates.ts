export type DateRangePreset = "today" | "yesterday" | "7d" | "month";

/** Convierte un preset de fecha (?range=) en límites [desde, hasta) en ISO. */
export function resolveDateRange(preset: string | undefined): { from: string; to: string } | null {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (preset as DateRangePreset) {
    case "today": {
      const from = startOfDay(now);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "yesterday": {
      const to = startOfDay(now);
      const from = new Date(to);
      from.setDate(from.getDate() - 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "7d": {
      const to = new Date(now);
      to.setDate(to.getDate() + 1);
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    default:
      return null;
  }
}
