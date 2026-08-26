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
import { VoidExpenseButton } from "@/components/gastos/void-expense-button";
import { EXPENSE_STATUS_LABELS } from "@/lib/cash";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { Expense, ExpenseCategory } from "@/types/database";

export interface ExpenseRow extends Expense {
  category: Pick<ExpenseCategory, "name"> | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export function ExpenseList({ expenses, canVoid }: { expenses: ExpenseRow[]; canVoid: boolean }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              {canVoid && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{formatDate(e.spent_at)}</TableCell>
                <TableCell className="font-medium text-foreground">{e.description}</TableCell>
                <TableCell className="text-muted-foreground">{e.category?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[e.payment_method]}
                </TableCell>
                <TableCell className="text-foreground">{formatCurrencyCents(e.amount_cents)}</TableCell>
                <TableCell>
                  <Badge variant={e.status === "registered" ? "default" : "outline"}>
                    {EXPENSE_STATUS_LABELS[e.status]}
                  </Badge>
                </TableCell>
                {canVoid && (
                  <TableCell>
                    {e.status === "registered" && <VoidExpenseButton expenseId={e.id} />}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {expenses.map((e) => (
          <MobileListItem
            key={e.id}
            title={e.description}
            subtitle={`${formatDate(e.spent_at)} · ${e.category?.name ?? "Sin categoría"}`}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrencyCents(e.amount_cents)}
                </span>
                <Badge variant={e.status === "registered" ? "default" : "outline"} className="text-[10px]">
                  {EXPENSE_STATUS_LABELS[e.status]}
                </Badge>
              </div>
            }
          />
        ))}
      </MobileList>
    </>
  );
}
