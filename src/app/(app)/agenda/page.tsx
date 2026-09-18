import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { DateNav } from "@/components/agenda/date-nav";
import { AppointmentFormSheet } from "@/components/agenda/appointment-form-sheet";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import { agendaAllowsUnassigned, staffTermsFor } from "@/lib/staff-terms";
import type { AppointmentRow } from "@/components/agenda/appointment-list";
import { monthGridDays, shiftDate, startOfWeek, type AgendaView } from "@/lib/agenda-dates";
import type { Customer, Product, Professional, Service } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ date?: string; view?: string }>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function resolveView(view?: string): AgendaView {
  return view === "week" || view === "month" ? view : "day";
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { date: dateParam, view: viewParam } = await searchParams;
  const date = dateParam || today();
  const view = resolveView(viewParam);
  const companyId = session.activeCompany.id;
  const supabase = await createClient();

  let rangeStart = date;
  let rangeEnd = date;
  let weekStart = date;
  if (view === "week") {
    weekStart = startOfWeek(date);
    rangeStart = weekStart;
    rangeEnd = shiftDate(weekStart, 6);
  } else if (view === "month") {
    const gridDays = monthGridDays(date);
    rangeStart = gridDays[0];
    rangeEnd = gridDays[gridDays.length - 1];
  }

  const [
    { data: appointmentsData },
    { data: customersData },
    { data: servicesData },
    { data: professionalsData },
    { data: productsData },
    { data: openRegisterData },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, customers(first_name,last_name), services(name), professionals(name,photo_url)")
      .eq("company_id", companyId)
      .gte("appointment_date", rangeStart)
      .lte("appointment_date", rangeEnd)
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
      .from("professionals")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("cash_registers")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "open")
      .maybeSingle(),
  ]);

  const appointments = (appointmentsData ?? []) as unknown as AppointmentRow[];
  const customers = (customersData ?? []) as Customer[];
  const services = (servicesData ?? []) as Service[];
  const professionals = (professionalsData ?? []) as Professional[];
  const products = (productsData ?? []) as Product[];
  const hasOpenCashRegister = Boolean(openRegisterData);

  const dayAppointments = appointments.filter((a) => a.appointment_date === date);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Citas de tu negocio."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateNav date={date} view={view} />
            <AppointmentFormSheet
              terms={staffTermsFor(session.activeCompany.business_type)}
              date={date}
              customers={customers}
              services={services}
              professionals={professionals}
            />
          </div>
        }
      />

      <AgendaBoard
        view={view}
        date={date}
        weekStart={weekStart}
        appointments={appointments}
        dayAppointments={dayAppointments}
        customers={customers}
        services={services}
        professionals={professionals}
        products={products}
        hasOpenCashRegister={hasOpenCashRegister}
        allowUnassigned={agendaAllowsUnassigned(session.activeCompany.business_type)}
        terms={staffTermsFor(session.activeCompany.business_type)}
      />
    </div>
  );
}
