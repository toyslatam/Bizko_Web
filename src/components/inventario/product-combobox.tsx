"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/inventory";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import type { Product } from "@/types/database";

export function ProductCombobox({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Package className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{selected ? selected.name : "Selecciona un producto"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar producto..." />
          <CommandList>
            <CommandEmpty>No encontramos ese producto.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Package className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatQuantity(p.current_stock)} {UNIT_SHORT_LABELS[p.unit]}
                  </span>
                  <Check
                    className={cn("ml-1 size-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
