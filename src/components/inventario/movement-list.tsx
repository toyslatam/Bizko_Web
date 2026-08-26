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
import { MOVEMENT_TYPE_LABELS, formatQuantity } from "@/lib/inventory";
import type { InventoryMovement, Product, Profile } from "@/types/database";

export interface MovementRow extends InventoryMovement {
  product: Pick<Product, "name" | "unit"> | null;
  user: Pick<Profile, "first_name" | "last_name" | "email"> | null;
}

const TYPE_VARIANT: Record<InventoryMovement["movement_type"], "default" | "secondary" | "outline" | "destructive"> = {
  in: "default",
  return: "default",
  out: "destructive",
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

function userLabel(user: MovementRow["user"]) {
  if (!user) return "—";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email.split("@")[0];
}

export function MovementList({ movements }: { movements: MovementRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Antes → Después</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                <TableCell className="font-medium text-foreground">{m.product?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[m.movement_type]}>
                    {MOVEMENT_TYPE_LABELS[m.movement_type]}
                  </Badge>
                </TableCell>
                <TableCell className={m.quantity < 0 ? "text-destructive" : "text-success"}>
                  {m.quantity > 0 ? "+" : ""}
                  {formatQuantity(m.quantity)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatQuantity(m.previous_stock)} → {formatQuantity(m.new_stock)}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.reason || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{userLabel(m.user)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {movements.map((m) => (
          <MobileListItem
            key={m.id}
            title={m.product?.name ?? "—"}
            subtitle={`${formatDate(m.created_at)} · ${m.reason || MOVEMENT_TYPE_LABELS[m.movement_type]}`}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span className={m.quantity < 0 ? "text-sm font-medium text-destructive" : "text-sm font-medium text-success"}>
                  {m.quantity > 0 ? "+" : ""}
                  {formatQuantity(m.quantity)}
                </span>
                <Badge variant={TYPE_VARIANT[m.movement_type]} className="text-[10px]">
                  {MOVEMENT_TYPE_LABELS[m.movement_type]}
                </Badge>
              </div>
            }
          />
        ))}
      </MobileList>
    </>
  );
}
