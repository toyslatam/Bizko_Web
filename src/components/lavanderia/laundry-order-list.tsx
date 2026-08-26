import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Badge } from "@/components/ui/badge";
import { customerFullName, LAUNDRY_ORDER_STATUS_LABELS } from "@/lib/catalog";
import type { Customer, LaundryOrder } from "@/types/database";

interface LaundryOrderWithCustomer extends LaundryOrder {
  customer: Customer | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: LaundryOrder["status"] }) {
  return (
    <Badge variant={status === "delivered" || status === "ready" ? "default" : "outline"}>
      {LAUNDRY_ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function LaundryOrderList({ orders }: { orders: LaundryOrderWithCustomer[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/lavanderia/${o.id}`} className="block">
                    {o.order_number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {o.customer ? customerFullName(o.customer) : "Cliente general"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(o.received_at)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={o.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {orders.map((o) => (
          <MobileListItem
            key={o.id}
            href={`/lavanderia/${o.id}`}
            title={o.order_number}
            subtitle={o.customer ? customerFullName(o.customer) : "Cliente general"}
            trailing={<StatusBadge status={o.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}
