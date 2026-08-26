import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { StatusBadge } from "@/components/catalog/status-badge";
import { customerFullName, customerInitials } from "@/lib/catalog";
import type { Customer } from "@/types/database";

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/clientes/${c.id}`} className="block">
                    {customerFullName(c)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.city || "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {customers.map((c) => (
          <MobileListItem
            key={c.id}
            href={`/clientes/${c.id}`}
            title={customerFullName(c)}
            subtitle={c.phone || c.city || undefined}
            leading={
              <Avatar className="size-9">
                <AvatarFallback className="bg-brand/15 text-xs font-semibold text-brand">
                  {customerInitials(c)}
                </AvatarFallback>
              </Avatar>
            }
            trailing={<StatusBadge status={c.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}
