"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "@/lib/orders";

export function OrdersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("fulfillment") ?? "all"} onValueChange={(v) => updateParam("fulfillment", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tipo de entrega" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Domicilio y recoger</SelectItem>
          {Object.entries(DELIVERY_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("range") ?? "all"} onValueChange={(v) => updateParam("range", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Fecha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las fechas</SelectItem>
          <SelectItem value="today">Hoy</SelectItem>
          <SelectItem value="yesterday">Ayer</SelectItem>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="month">Este mes</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
