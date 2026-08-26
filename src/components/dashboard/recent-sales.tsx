import Link from "next/link";
import { customerFullName } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import type { SaleRow } from "@/components/ventas/sale-list";

export function RecentSales({ sales }: { sales: SaleRow[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {sales.map((sale) => (
        <Link
          key={sale.id}
          href={`/ventas/${sale.id}`}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {sale.customer ? customerFullName(sale.customer) : "Cliente general"}
            </p>
            <p className="text-xs text-muted-foreground">{sale.sale_number}</p>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {formatCurrencyCents(sale.total_cents)}
          </span>
        </Link>
      ))}
    </div>
  );
}
