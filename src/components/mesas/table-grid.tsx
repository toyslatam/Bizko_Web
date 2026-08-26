import Link from "next/link";
import { Users } from "lucide-react";
import { TableStatusBadge } from "@/components/mesas/table-status-badge";
import type { RestaurantTable } from "@/types/database";

export function TableGrid({ tables }: { tables: RestaurantTable[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {tables.map((table) => (
        <Link
          key={table.id}
          href={`/mesas/${table.id}`}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/50 hover:bg-muted/40"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading text-base font-semibold text-foreground">{table.name}</p>
            <TableStatusBadge status={table.status} />
          </div>
          {table.capacity !== null && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" /> {table.capacity} personas
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
