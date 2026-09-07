"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX2, Check, Clock, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createPublicAppointmentAction } from "@/app/store/[slug]/actions";
import { formatCurrencyCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicProfessional, PublicService } from "@/types/database";

function todayISO(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatSlotLabel(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

export function BookingFlow({
  slug,
  service,
  initialProfessionals,
}: {
  slug: string;
  service: PublicService;
  initialProfessionals: PublicProfessional[];
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const needsProfessionalChoice = initialProfessionals.length > 1;

  const [professionalId, setProfessionalId] = React.useState<string | null>(
    initialProfessionals.length === 1 ? initialProfessionals[0].id : null,
  );
  const [date, setDate] = React.useState("");
  const [slots, setSlots] = React.useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const selectedProfessional = initialProfessionals.find((p) => p.id === professionalId) ?? null;

  React.useEffect(() => {
    let active = true;

    async function loadSlots() {
      setSelectedSlot(null);
      if (!professionalId || !date) {
        setSlots([]);
        return;
      }

      setLoadingSlots(true);
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_professional_id: professionalId,
        p_appointment_date: date,
        p_duration_minutes: service.duration_minutes ?? 30,
      });
      if (!active) return;
      if (error) {
        toast.error("No pudimos cargar los horarios disponibles.");
        setSlots([]);
      } else {
        setSlots(((data as { slot_start: string }[]) ?? []).map((s) => s.slot_start));
      }
      setLoadingSlots(false);
    }

    loadSlots();

    return () => {
      active = false;
    };
  }, [professionalId, date, service.duration_minutes, supabase]);

  if (initialProfessionals.length === 0) {
    return (
      <EmptyState
        icon={UserRound}
        title="Este servicio no tiene profesionales disponibles por ahora"
        description="Contacta al negocio directamente para agendar tu cita."
      />
    );
  }

  const canSubmit = Boolean(professionalId && date && selectedSlot && name.trim() && phone.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!professionalId || !date || !selectedSlot) {
      toast.error("Elige profesional, fecha y hora para tu cita.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error("Tu nombre y teléfono son obligatorios.");
      return;
    }

    setSubmitting(true);
    const result = await createPublicAppointmentAction({
      slug,
      serviceId: service.id,
      professionalId,
      appointmentDate: date,
      startTime: selectedSlot,
      customerName: name,
      customerPhone: phone,
      notes,
    });
    setSubmitting(false);

    if ("error" in result) {
      toast.error("No pudimos reservar tu cita", { description: result.error });
      return;
    }

    const params = new URLSearchParams({
      servicio: service.name,
      precio: String(service.price_cents),
      profesional: selectedProfessional?.name ?? "",
      fecha: date,
      hora: selectedSlot,
      nombre: name,
    });
    router.push(`/store/${slug}/cita/${result.appointmentId}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-28">
      <section className="space-y-1 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Servicio</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">{service.name}</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrencyCents(service.price_cents)}</p>
        </div>
        {service.duration_minutes && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> {service.duration_minutes} min
          </p>
        )}
      </section>

      {needsProfessionalChoice && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Elige un profesional</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {initialProfessionals.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProfessionalId(p.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center",
                  professionalId === p.id ? "border-brand bg-brand/5" : "border-border",
                )}
              >
                <Avatar size="lg">
                  {p.photo_url && <AvatarImage src={p.photo_url} alt="" />}
                  <AvatarFallback>{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground">{p.name}</span>
                {p.specialty && <span className="text-[11px] text-muted-foreground">{p.specialty}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {!needsProfessionalChoice && selectedProfessional && (
        <section className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Avatar size="lg">
            {selectedProfessional.photo_url && <AvatarImage src={selectedProfessional.photo_url} alt="" />}
            <AvatarFallback>{selectedProfessional.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{selectedProfessional.name}</p>
            {selectedProfessional.specialty && (
              <p className="text-xs text-muted-foreground">{selectedProfessional.specialty}</p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Elige una fecha</h2>
        <Input
          type="date"
          min={todayISO()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={!professionalId}
        />
      </section>

      {professionalId && date && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Elige una hora</h2>
          {loadingSlots ? (
            <p className="text-sm text-muted-foreground">Buscando horarios disponibles...</p>
          ) : slots.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="No hay horarios disponibles ese día"
              description="Prueba otra fecha."
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-sm font-medium",
                    selectedSlot === slot ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground",
                  )}
                >
                  {selectedSlot === slot && <Check className="size-3.5" />}
                  {formatSlotLabel(slot)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Tus datos</h2>
        <div className="space-y-1.5">
          <Label htmlFor="bookingName">Nombre</Label>
          <Input id="bookingName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bookingPhone">Teléfono</Label>
          <Input id="bookingPhone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bookingNotes">Notas (opcional)</Label>
          <Textarea
            id="bookingNotes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Alguna preferencia para tu cita..."
          />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting || !canSubmit}>
            {submitting ? "Reservando cita..." : "Solicitar cita"}
          </Button>
        </div>
      </div>
    </form>
  );
}
