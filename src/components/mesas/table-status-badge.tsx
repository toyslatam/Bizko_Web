import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TableStatus } from "@/types/database";

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  available: "Disponible",
  occupied: "Ocupada",
  reserved: "Reservada",
  attending: "Atendiendo",
};

const TABLE_STATUS_CLASSNAMES: Record<TableStatus, string> = {
  available: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  occupied: "border-transparent bg-brand text-white",
  reserved: "border-border bg-secondary text-secondary-foreground",
  attending: "border-warning/30 bg-warning/15 text-warning-foreground",
};

export function TableStatusBadge({ status, className }: { status: TableStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(TABLE_STATUS_CLASSNAMES[status], className)}>
      {TABLE_STATUS_LABELS[status]}
    </Badge>
  );
}
