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
import { CASH_MOVEMENT_TYPE_LABELS } from "@/lib/cash";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { CashMovement, CashMovementType, Profile } from "@/types/database";

export interface CashMovementRow extends CashMovement {
  user: Pick<Profile, "first_name" | "last_name" | "email"> | null;
}

const TYPE_VARIANT: Record<CashMovementType, "default" | "secondary" | "destructive"> = {
  income: "default",
  expense: "destructive",
  adjustment: "secondary",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userLabel(user: CashMovementRow["user"]) {
  if (!user) return "—";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email.split("@")[0];
}

export function CashMovementList({ movements }: { movements: CashMovementRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[m.movement_type]}>
                    {CASH_MOVEMENT_TYPE_LABELS[m.movement_type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground">{m.description || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[m.payment_method]}
                </TableCell>
                <TableCell className="text-muted-foreground">{userLabel(m.user)}</TableCell>
                <TableCell className={m.amount_cents < 0 ? "text-destructive" : "text-success"}>
                  {m.amount_cents > 0 ? "+" : ""}
                  {formatCurrencyCents(m.amount_cents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {movements.map((m) => (
          <MobileListItem
            key={m.id}
            title={m.description || CASH_MOVEMENT_TYPE_LABELS[m.movement_type]}
            subtitle={`${formatDate(m.created_at)} · ${PAYMENT_METHOD_LABELS[m.payment_method]}`}
            trailing={
              <span className={m.amount_cents < 0 ? "text-sm font-medium text-destructive" : "text-sm font-medium text-success"}>
                {m.amount_cents > 0 ? "+" : ""}
                {formatCurrencyCents(m.amount_cents)}
              </span>
            }
          />
        ))}
      </MobileList>
    </>
  );
}
