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
import { customerFullName, WORK_ORDER_STATUS_LABELS } from "@/lib/catalog";
import type { Customer, Vehicle, WorkOrder } from "@/types/database";

type WorkOrderRow = WorkOrder & {
  customers: Pick<Customer, "first_name" | "last_name"> | null;
  vehicles: Pick<Vehicle, "plate" | "brand" | "model"> | null;
};

function vehicleLabel(vehicle: WorkOrderRow["vehicles"]) {
  if (!vehicle) return "—";
  const details = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  return details ? `${vehicle.plate} · ${details}` : vehicle.plate;
}

export function WorkOrderList({ orders }: { orders: WorkOrderRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/ordenes-trabajo/${order.id}`} className="block">
                    {order.order_number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {vehicleLabel(order.vehicles)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.customers ? customerFullName(order.customers) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{WORK_ORDER_STATUS_LABELS[order.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {orders.map((order) => (
          <MobileListItem
            key={order.id}
            href={`/ordenes-trabajo/${order.id}`}
            title={order.order_number}
            subtitle={
              order.customers
                ? `${vehicleLabel(order.vehicles)} · ${customerFullName(order.customers)}`
                : vehicleLabel(order.vehicles)
            }
            trailing={<Badge variant="outline">{WORK_ORDER_STATUS_LABELS[order.status]}</Badge>}
          />
        ))}
      </MobileList>
    </>
  );
}
