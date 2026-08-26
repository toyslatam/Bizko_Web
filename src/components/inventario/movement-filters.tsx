"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOVEMENT_TYPE_LABELS } from "@/lib/inventory";
import type { Product } from "@/types/database";

export function MovementFilters({ products }: { products: Product[] }) {
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
      <Select value={searchParams.get("product") ?? "all"} onValueChange={(v) => updateParam("product", v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Producto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los productos</SelectItem>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("type") ?? "all"} onValueChange={(v) => updateParam("type", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
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
