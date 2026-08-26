"use client";

import { ArrowDownUp, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "Recomendados" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
];

export function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("orden");
  const activeLabel = SORT_OPTIONS.find((o) => o.value === current)?.label ?? SORT_OPTIONS[0].label;

  function handleSelect(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("orden", value);
    else params.delete("orden");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-muted">
        <ArrowDownUp className="size-3.5 text-muted-foreground" />
        {activeLabel}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.label} onSelect={() => handleSelect(o.value)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
