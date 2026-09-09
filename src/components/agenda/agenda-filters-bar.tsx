"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/catalog";
import type { Professional, Service } from "@/types/database";

export type AgendaFilters = {
  search: string;
  professionalId: string;
  serviceId: string;
  status: string;
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: APPOINTMENT_STATUS_LABELS.pending },
  { value: "confirmed", label: APPOINTMENT_STATUS_LABELS.confirmed },
  { value: "in_progress", label: APPOINTMENT_STATUS_LABELS.in_progress },
  { value: "completed", label: APPOINTMENT_STATUS_LABELS.completed },
];

export function AgendaFiltersBar({
  professionals,
  services,
  onFilterChange,
}: {
  professionals: Professional[];
  services: Service[];
  onFilterChange: (filters: AgendaFilters) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [professionalId, setProfessionalId] = React.useState("all");
  const [serviceId, setServiceId] = React.useState("all");
  const [status, setStatus] = React.useState<string>("all");

  function emit(next: Partial<AgendaFilters>) {
    onFilterChange({
      search,
      professionalId,
      serviceId,
      status,
      ...next,
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              emit({ search: e.target.value });
            }}
            placeholder="Buscar cliente…"
            className="pl-8"
          />
        </div>

        <Select
          value={professionalId}
          onValueChange={(value) => {
            setProfessionalId(value);
            emit({ professionalId: value });
          }}
        >
          <SelectTrigger className="w-auto min-w-32">
            <SelectValue placeholder="Profesional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los profesionales</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={serviceId}
          onValueChange={(value) => {
            setServiceId(value);
            emit({ serviceId: value });
          }}
        >
          <SelectTrigger className="w-auto min-w-32">
            <SelectValue placeholder="Servicio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los servicios</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus(tab.value);
              emit({ status: tab.value });
            }}
            className={cn(
              "rounded-full",
              status === tab.value && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
            )}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
