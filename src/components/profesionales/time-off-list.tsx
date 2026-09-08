import { TimeOffDialog } from "@/components/profesionales/time-off-dialog";
import { DeleteTimeOffButton } from "@/components/profesionales/delete-time-off-button";
import type { ProfessionalTimeOff } from "@/types/database";

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (isSameDay(start, end)) {
    const datePart = start.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
    const startTime = start.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
    const endTime = end.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
    return `${datePart}, ${startTime} – ${endTime}`;
  }

  const startPart = start.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const endPart = end.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `${startPart} – ${endPart}`;
}

export function TimeOffList({
  professionalId,
  timeOffs,
}: {
  professionalId: string;
  timeOffs: ProfessionalTimeOff[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TimeOffDialog professionalId={professionalId} />
      </div>

      {timeOffs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Sin bloqueos registrados.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {timeOffs.map((timeOff) => (
            <div key={timeOff.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatRange(timeOff.starts_at, timeOff.ends_at)}
                </p>
                {timeOff.reason && (
                  <p className="text-xs text-muted-foreground">{timeOff.reason}</p>
                )}
              </div>
              <DeleteTimeOffButton timeOffId={timeOff.id} professionalId={professionalId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
