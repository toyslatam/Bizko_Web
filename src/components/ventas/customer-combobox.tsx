"use client";

import * as React from "react";
import { Check, ChevronsUpDown, User, Users } from "lucide-react";
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
import { customerFullName } from "@/lib/catalog";
import { GENERAL_CUSTOMER_VALUE } from "@/lib/sales";
import type { Customer } from "@/types/database";

export function CustomerCombobox({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = customers.find((c) => c.id === value);

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
            {selected ? (
              <User className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Users className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">
              {selected ? customerFullName(selected) : "Cliente general"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>No encontramos ese cliente.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={GENERAL_CUSTOMER_VALUE}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Users className="size-4 text-muted-foreground" />
                Cliente general
                <Check className={cn("ml-auto size-4", !value ? "opacity-100" : "opacity-0")} />
              </CommandItem>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={customerFullName(c)}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <User className="size-4 text-muted-foreground" />
                  {customerFullName(c)}
                  <Check
                    className={cn("ml-auto size-4", value === c.id ? "opacity-100" : "opacity-0")}
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
