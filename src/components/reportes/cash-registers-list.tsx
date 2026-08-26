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
import { formatCurrencyCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashRegister } from "@/types/database";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function differenceClass(diff: number) {
  return diff < 0 ? "text-destructive" : "text-success";
}

export function CashRegistersList({ registers }: { registers: CashRegister[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha de cierre</TableHead>
              <TableHead>Apertura</TableHead>
              <TableHead>Contado</TableHead>
              <TableHead>Esperado</TableHead>
              <TableHead>Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registers.map((r) => {
              const diff = r.difference_cents ?? 0;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/caja/historial/${r.id}`}>
                      {r.closed_at ? formatDate(r.closed_at) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrencyCents(r.opening_amount_cents)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.counted_amount_cents !== null ? formatCurrencyCents(r.counted_amount_cents) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.expected_amount_cents !== null ? formatCurrencyCents(r.expected_amount_cents) : "—"}
                  </TableCell>
                  <TableCell className={cn("font-medium", differenceClass(diff))}>
                    {formatCurrencyCents(diff)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {registers.map((r) => {
          const diff = r.difference_cents ?? 0;
          return (
            <MobileListItem
              key={r.id}
              href={`/caja/historial/${r.id}`}
              title={r.closed_at ? formatDate(r.closed_at) : "—"}
              subtitle={`Apertura ${formatCurrencyCents(r.opening_amount_cents)}`}
              trailing={
                <span className={cn("text-sm font-semibold", differenceClass(diff))}>
                  {formatCurrencyCents(diff)}
                </span>
              }
            />
          );
        })}
      </MobileList>
    </>
  );
}
