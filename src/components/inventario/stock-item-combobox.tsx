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
import type { StockItem } from "@/lib/stock-items";

/**
 * Igual que ProductCombobox pero sobre StockItem, así una variante concreta
 * ("Camisa Urbana · M / Negro") también es seleccionable.
 */
export function StockItemCombobox({
  items,
  value,
  onChange,
}: {
  items: StockItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = items.find((i) => i.key === value);

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
            <span className="truncate">{selected ? selected.label : "Selecciona un producto"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar producto o variante..." />
          <CommandList>
            <CommandEmpty>No encontramos ese producto.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.key}
                  // Incluye la key para que dos variantes con la misma etiqueta
                  // sigan siendo seleccionables por separado.
                  value={`${item.label} ${item.key}`}
                  onSelect={() => {
                    onChange(item.key);
                    setOpen(false);
                  }}
                >
                  <Package className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatQuantity(item.stock)} {UNIT_SHORT_LABELS[item.unit]}
                  </span>
                  <Check
                    className={cn("ml-1 size-4", value === item.key ? "opacity-100" : "opacity-0")}
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
