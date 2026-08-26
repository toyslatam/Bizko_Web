import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/catalog";
import type { EntityStatus } from "@/types/database";

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "outline"}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
