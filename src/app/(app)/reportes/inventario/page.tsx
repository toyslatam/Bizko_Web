import { redirect } from "next/navigation";
import { Boxes, PackageCheck, TriangleAlert, PackageX, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { stockStatus, formatQuantity } from "@/lib/inventory";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";
import type { ProductUnit } from "@/types/database";

interface MovementTopRow {
  product_id: string;
  name: string;
  unit: ProductUnit;
  in_qty: number;
  out_qty: number;
  adjustment_qty: number;
  return_qty: number;
  movement_count: number;
}

type RotationLevel = "alta" | "baja" | "sin_movimiento";

interface RotationRow {
  product_id: string;
  name: string;
  unit: ProductUnit;
  current_stock: number;
  out_qty: number;
  rotation: RotationLevel;
}

interface RotationCsvRow {
  producto: string;
  stock_actual: string;
  salidas: string;
  rotacion: string;
}

const ROTATION_LABELS: Record<RotationLevel, string> = {
  alta: "Alta rotación",
  baja: "Baja rotación",
  sin_movimiento: "Sin movimiento",
};

const ROTATION_BADGE_VARIANTS: Record<RotationLevel, "default" | "outline" | "secondary"> = {
  alta: "default",
  baja: "outline",
  sin_movimiento: "secondary",
};

export default async function InventarioReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.activeMembership || !can(session.activeMembership.role, "reportes.ver")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const range = resolveReportPeriod(await searchParams, session.activeCompany.timezone);

  const [{ data: trackedProducts }, { data: movementTop }, { data: rotation }] = await Promise.all([
    supabase.from("products").select("current_stock, minimum_stock, cost_cents").eq("company_id", companyId).eq("track_inventory", true),
    supabase.rpc("report_inventory_movement_top", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
      p_limit: 10,
    }),
    supabase.rpc("report_inventory_rotation", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
    }),
  ]);

  const products = trackedProducts ?? [];

  if (products.length === 0) {
    return (
      <div>
        <PageHeader title="Inventario" description="Stock disponible, bajo, agotado y rotación." />
        <div className="mb-5">
          <PeriodFilter />
        </div>
        <EmptyState
          icon={Boxes}
          title="Activa el control de inventario en tus productos para ver este reporte."
          description="Ve a Catálogo y activa el control de stock en los productos que quieras monitorear."
        />
      </div>
    );
  }

  let availableCount = 0;
  let lowCount = 0;
  let outCount = 0;
  let inventoryValueCents = 0;
  for (const p of products) {
    const status = stockStatus(p);
    if (status === "available") availableCount += 1;
    else if (status === "low") lowCount += 1;
    else outCount += 1;
    inventoryValueCents += p.current_stock * p.cost_cents;
  }

  const movementRows = (movementTop ?? []) as MovementTopRow[];
  const rotationRows = (rotation ?? []) as RotationRow[];

  const csvRows: RotationCsvRow[] = rotationRows.map((r) => ({
    producto: r.name,
    stock_actual: `${formatQuantity(r.current_stock)} ${UNIT_SHORT_LABELS[r.unit]}`,
    salidas: `${formatQuantity(r.out_qty)} ${UNIT_SHORT_LABELS[r.unit]}`,
    rotacion: ROTATION_LABELS[r.rotation],
  }));

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Stock disponible, bajo, agotado y rotación."
        actions={
          <CsvExportButton
            filename={`inventario-${range.label}.csv`}
            rows={csvRows}
            columns={[
              { key: "producto", label: "Producto" },
              { key: "stock_actual", label: "Stock actual" },
              { key: "salidas", label: "Salidas" },
              { key: "rotacion", label: "Rotación" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Productos disponibles" value={String(availableCount)} icon={PackageCheck} />
          <StatCard label="Stock bajo" value={String(lowCount)} icon={TriangleAlert} />
          <StatCard label="Agotados" value={String(outCount)} icon={PackageX} />
          <StatCard
            label="Valor aproximado del inventario"
            value={formatCurrencyCents(inventoryValueCents)}
            icon={DollarSign}
            hint="Costo × stock actual"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Top productos con mayor movimiento</p>
          {movementRows.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No hubo movimientos de inventario en este período."
              description="Ajusta el período para ver el detalle de movimientos."
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Entradas</TableHead>
                      <TableHead>Salidas</TableHead>
                      <TableHead>Ajustes</TableHead>
                      <TableHead>Devoluciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementRows.map((m) => (
                      <TableRow key={m.product_id}>
                        <TableCell className="font-medium text-foreground">{m.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(m.in_qty)} {UNIT_SHORT_LABELS[m.unit]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(m.out_qty)} {UNIT_SHORT_LABELS[m.unit]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(m.adjustment_qty)} {UNIT_SHORT_LABELS[m.unit]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(m.return_qty)} {UNIT_SHORT_LABELS[m.unit]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {movementRows.map((m) => (
                  <MobileListItem
                    key={m.product_id}
                    title={m.name}
                    subtitle={`Entradas ${formatQuantity(m.in_qty)} · Salidas ${formatQuantity(m.out_qty)} ${UNIT_SHORT_LABELS[m.unit]}`}
                    trailing={
                      <span className="text-xs text-muted-foreground">
                        {m.movement_count} mov.
                      </span>
                    }
                  />
                ))}
              </MobileList>
            </>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-foreground">Rotación de productos</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Basado en las salidas registradas en el período seleccionado, no es una predicción de ventas futuras.
          </p>
          {rotationRows.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No hay productos con control de inventario activo."
              description="Activa el control de stock en tus productos para ver la rotación."
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Stock actual</TableHead>
                      <TableHead>Salidas</TableHead>
                      <TableHead>Rotación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rotationRows.map((r) => (
                      <TableRow key={r.product_id}>
                        <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(r.current_stock)} {UNIT_SHORT_LABELS[r.unit]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(r.out_qty)} {UNIT_SHORT_LABELS[r.unit]}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ROTATION_BADGE_VARIANTS[r.rotation]}>{ROTATION_LABELS[r.rotation]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {rotationRows.map((r) => (
                  <MobileListItem
                    key={r.product_id}
                    title={r.name}
                    subtitle={`Stock ${formatQuantity(r.current_stock)} ${UNIT_SHORT_LABELS[r.unit]} · Salidas ${formatQuantity(r.out_qty)}`}
                    trailing={<Badge variant={ROTATION_BADGE_VARIANTS[r.rotation]}>{ROTATION_LABELS[r.rotation]}</Badge>}
                  />
                ))}
              </MobileList>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
