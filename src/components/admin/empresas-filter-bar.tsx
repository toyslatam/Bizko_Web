"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/plans";
import { BUSINESS_MODULES } from "@/modules/registry";
import type { PlanCode, SubscriptionStatus } from "@/types/database";

const PLAN_OPTIONS: { value: PlanCode; label: string }[] = [
  { value: "basico", label: "Básico" },
  { value: "negocio", label: "Negocio" },
  { value: "pro", label: "Pro" },
];

const STATUS_OPTIONS = Object.entries(SUBSCRIPTION_STATUS_LABELS) as [SubscriptionStatus, string][];

export function EmpresasFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (searchParams.get("q") ?? "")) updateParam("q", search || null);
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <FilterBar
      searchPlaceholder="Buscar por negocio o correo del propietario..."
      searchDefaultValue={search}
      onSearchChange={setSearch}
    >
      <Select value={searchParams.get("plan") ?? "all"} onValueChange={(v) => updateParam("plan", v)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los planes</SelectItem>
          {PLAN_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("business_type") ?? "all"}
        onValueChange={(v) => updateParam("business_type", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tipo de negocio" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {BUSINESS_MODULES.map((m) => (
            <SelectItem key={m.type} value={m.type}>
              {m.emoji} {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
