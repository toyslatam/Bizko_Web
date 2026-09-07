import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarCheck2, Clock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";

interface CitaPageProps {
  params: Promise<{ slug: string; appointmentId: string }>;
  searchParams: Promise<{
    servicio?: string;
    precio?: string;
    profesional?: string;
    fecha?: string;
    hora?: string;
    nombre?: string;
  }>;
}

function formatTimeLabel(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

export default async function AppointmentConfirmationPage({ params, searchParams }: CitaPageProps) {
  const { slug, appointmentId } = await params;
  const { servicio, precio, profesional, fecha, hora, nombre } = await searchParams;

  if (!servicio || !fecha || !hora) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-6 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/20 text-success">
          <CalendarCheck2 className="size-6" />
        </span>
        <p className="font-heading text-lg font-semibold text-foreground">¡Cita solicitada!</p>
        {nombre && <p className="text-sm text-muted-foreground">Gracias, {nombre}.</p>}
        <p className="text-sm text-muted-foreground">Te contactaremos para confirmar tu cita.</p>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estado</span>
          <span className="font-medium text-foreground">{APPOINTMENT_STATUS_LABELS.pending}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Servicio</span>
          <span className="font-medium text-foreground">{servicio}</span>
        </div>
        {profesional && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profesional</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <UserRound className="size-3.5" /> {profesional}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Fecha</span>
          <span className="font-medium text-foreground capitalize">{formatDateLabel(fecha)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Hora</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Clock className="size-3.5" /> {formatTimeLabel(hora)}
          </span>
        </div>
        {precio && (
          <div className="flex items-center justify-between border-t border-border pt-2 font-heading text-base font-semibold text-foreground">
            <span>Precio</span>
            <span>{formatCurrencyCents(Number(precio))}</span>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">Referencia de cita: {appointmentId}</p>

      <Button asChild size="lg" className="mt-6 h-11 w-full">
        <Link href={`/store/${slug}`}>Volver al catálogo</Link>
      </Button>
    </div>
  );
}
