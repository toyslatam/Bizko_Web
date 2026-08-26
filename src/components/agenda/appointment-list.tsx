import { AppointmentStatusSelect } from "@/components/agenda/appointment-status-select";
import { customerFullName } from "@/lib/catalog";
import type { Appointment, CompanyMember, Customer, Profile, Service } from "@/types/database";

type AppointmentRow = Appointment & {
  customers: Pick<Customer, "first_name" | "last_name"> | null;
  services: Pick<Service, "name"> | null;
};

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = Number(h);
  const period = hour >= 12 ? "p. m." : "a. m.";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${period}`;
}

export function AppointmentList({
  appointments,
  members,
}: {
  appointments: AppointmentRow[];
  members: (CompanyMember & { profile: Profile })[];
}) {
  function employeeName(employeeId: string | null) {
    if (!employeeId) return "Sin asignar";
    const member = members.find((m) => m.user_id === employeeId);
    if (!member) return "Sin asignar";
    const name = [member.profile.first_name, member.profile.last_name].filter(Boolean).join(" ");
    return name || member.profile.email;
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {appointments.map((a) => (
        <div key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-20 shrink-0 text-sm font-semibold text-foreground">
              {formatTime(a.start_time)}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {a.customers ? customerFullName(a.customers) : "Cliente general"}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.services?.name ?? "Sin servicio"} · {employeeName(a.employee_id)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <AppointmentStatusSelect appointment={a} />
          </div>
        </div>
      ))}
    </div>
  );
}
