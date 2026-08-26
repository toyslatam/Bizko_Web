import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DateNav } from "@/components/agenda/date-nav";
import { AppointmentFormSheet } from "@/components/agenda/appointment-form-sheet";
import { AppointmentList } from "@/components/agenda/appointment-list";
import type { Appointment, CompanyMember, Customer, Profile, Service } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { date: dateParam } = await searchParams;
  const date = dateParam || today();
  const companyId = session.activeCompany.id;
  const supabase = await createClient();

  const [{ data: appointmentsData }, { data: customersData }, { data: servicesData }, { data: membersData }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("*, customers(first_name,last_name), services(name)")
        .eq("company_id", companyId)
        .eq("appointment_date", date)
        .order("start_time", { ascending: true }),
      supabase
        .from("customers")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("first_name", { ascending: true }),
      supabase
        .from("services")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("company_members")
        .select("*, profile:profiles(*)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
    ]);

  const appointments = (appointmentsData ?? []) as unknown as (Appointment & {
    customers: Pick<Customer, "first_name" | "last_name"> | null;
    services: Pick<Service, "name"> | null;
  })[];
  const customers = (customersData ?? []) as Customer[];
  const services = (servicesData ?? []) as Service[];
  const members = (membersData ?? []) as unknown as (CompanyMember & { profile: Profile })[];

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Citas del día."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateNav date={date} />
            <AppointmentFormSheet
              date={date}
              customers={customers}
              services={services}
              members={members}
            />
          </div>
        }
      />

      {appointments.length > 0 ? (
        <AppointmentList appointments={appointments} members={members} />
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="Sin citas para este día"
          description="Cuando agendes una cita, aparecerá aquí."
          action={
            <AppointmentFormSheet
              date={date}
              customers={customers}
              services={services}
              members={members}
            />
          }
        />
      )}
    </div>
  );
}
