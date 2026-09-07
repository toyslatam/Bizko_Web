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
import type { Professional } from "@/types/database";

export function ServiceProfessionalsSection({
  serviceId,
  professionals,
  assignedProfessionalIds,
}: {
  serviceId: string;
  professionals: Professional[];
  assignedProfessionalIds: string[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = React.useState(new Set(assignedProfessionalIds));
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(professionalId: string, checked: boolean) {
    setPending(professionalId);
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
      if (checked) next.add(professionalId);
      else next.delete(professionalId);
      return next;
    });
    router.refresh();
  }

  if (professionals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no tienes profesionales activos en tu equipo.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {professionals.map((professional) => {
        const checked = assigned.has(professional.id);
        return (
          <div key={professional.id} className="flex items-center gap-2.5">
            <Checkbox
              id={`professional-${professional.id}`}
              checked={checked}
              disabled={pending === professional.id}
              onCheckedChange={(value) => toggle(professional.id, value === true)}
            />
            <Label htmlFor={`professional-${professional.id}`} className="cursor-pointer font-normal">
              {professional.name}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
