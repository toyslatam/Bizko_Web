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
import { customerFullName } from "@/lib/catalog";
import type { Customer, Vehicle } from "@/types/database";

type VehicleWithCustomer = Vehicle & {
  customers: Pick<Customer, "first_name" | "last_name"> | null;
};

export function VehicleList({ vehicles }: { vehicles: VehicleWithCustomer[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Marca / Modelo</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/vehiculos/${v.id}`} className="block">
                    {v.plate}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{v.color || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {v.customers ? customerFullName(v.customers) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {vehicles.map((v) => (
          <MobileListItem
            key={v.id}
            href={`/vehiculos/${v.id}`}
            title={v.plate}
            subtitle={[v.brand, v.model].filter(Boolean).join(" ") || undefined}
            trailing={
              v.customers ? (
                <span className="text-xs text-muted-foreground">
                  {customerFullName(v.customers)}
                </span>
              ) : undefined
            }
          />
        ))}
      </MobileList>
    </>
  );
}
