import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";

interface FilterBarProps {
  searchPlaceholder?: string;
  searchDefaultValue?: string;
  onSearchChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

/** Barra de filtros: búsqueda + slots para selects/chips adicionales. */
export function FilterBar({
  searchPlaceholder,
  searchDefaultValue,
  onSearchChange,
  children,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="sm:max-w-xs sm:flex-1">
        <SearchInput
          placeholder={searchPlaceholder}
          defaultValue={searchDefaultValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
