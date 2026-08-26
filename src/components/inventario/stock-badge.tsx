import { AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { stockStatus, STOCK_STATUS_LABELS } from "@/lib/inventory";
import type { Product } from "@/types/database";

export function StockBadge({ product }: { product: Pick<Product, "current_stock" | "minimum_stock"> }) {
  const status = stockStatus(product);

  if (status === "out") {
    return (
      <Badge variant="destructive">
        <XCircle /> {STOCK_STATUS_LABELS.out}
      </Badge>
    );
  }
  if (status === "low") {
    return (
      <Badge className="border-transparent bg-warning/15 text-warning-foreground">
        <AlertTriangle /> {STOCK_STATUS_LABELS.low}
      </Badge>
    );
  }
  return <Badge variant="default">{STOCK_STATUS_LABELS.available}</Badge>;
}
