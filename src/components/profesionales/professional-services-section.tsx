"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  assignServiceToProfessionalAction,
  unassignServiceFromProfessionalAction,
} from "@/app/(app)/profesionales/actions";
import type { Service } from "@/types/database";

export function ProfessionalServicesSection({
  professionalId,
  services,
  assignedServiceIds,
}: {
  professionalId: string;
  services: Service[];
  assignedServiceIds: string[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = React.useState(new Set(assignedServiceIds));
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(serviceId: string, checked: boolean) {
    setPending(serviceId);
    const result = checked
      ? await assignServiceToProfessionalAction(professionalId, serviceId)
      : await unassignServiceFromProfessionalAction(professionalId, serviceId);
    setPending(null);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setAssigned((prev) => {
      const next = new Set(prev);
      if (checked) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });
    router.refresh();
  }

  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no tienes servicios activos en tu catálogo.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {services.map((service) => {
        const checked = assigned.has(service.id);
        return (
          <div key={service.id} className="flex items-center gap-2.5">
            <Checkbox
              id={`service-${service.id}`}
              checked={checked}
              disabled={pending === service.id}
              onCheckedChange={(value) => toggle(service.id, value === true)}
            />
            <Label htmlFor={`service-${service.id}`} className="cursor-pointer font-normal">
              {service.name}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
