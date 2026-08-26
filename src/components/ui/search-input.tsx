import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchInput({
  className,
  placeholder = "Buscar...",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className={cn("pl-8", className)}
        {...props}
      />
    </div>
  );
}
