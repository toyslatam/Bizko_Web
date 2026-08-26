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

interface CategoryOption {
  id: string;
  name: string;
}

interface StatusOption {
  value: string;
  label: string;
}

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

interface ListToolbarProps {
  searchPlaceholder: string;
  categories?: CategoryOption[];
  categoryLabel?: string;
  /** Por defecto Activo/Inactivo; pásalo para otros estados (ej. inventario: Disponible/Stock bajo/Agotado). */
  statusOptions?: StatusOption[];
  statusLabel?: string;
  showStatusFilter?: boolean;
}

/** Búsqueda + filtro de estado (+ categoría opcional), sincronizados con la URL. */
export function ListToolbar({
  searchPlaceholder,
  categories,
  categoryLabel = "Categoría",
  statusOptions = DEFAULT_STATUS_OPTIONS,
  statusLabel = "Estado",
  showStatusFilter = true,
}: ListToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
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
      searchPlaceholder={searchPlaceholder}
      searchDefaultValue={search}
      onSearchChange={setSearch}
    >
      {showStatusFilter && (
        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(v) => updateParam("status", v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={statusLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {categories && categories.length > 0 && (
        <Select
          value={searchParams.get("category") ?? "all"}
          onValueChange={(v) => updateParam("category", v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={categoryLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FilterBar>
  );
}
