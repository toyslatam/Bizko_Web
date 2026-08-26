import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DollarSign, Users, Package, Wrench, Sparkles, ShoppingCart, Receipt, Boxes, Wallet, ClipboardList, Bike, CalendarClock, Shirt, PawPrint, ChefHat } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AttentionPanel, type AttentionItem } from "@/components/dashboard/attention-panel";
import { PerformancePanel, type TopSoldItem, type WeekSalePoint } from "@/components/dashboard/performance-panel";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { VerticalWidgetCard } from "@/components/dashboard/vertical-widget-card";
import { PlanUsageCard } from "@/components/dashboard/plan-usage-card";
import { formatCurrencyCents, greeting } from "@/lib/format";
import { getSessionContext, displayName } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { stockStatus } from "@/lib/inventory";
import { getPeriodRange, deltaPct } from "@/lib/date-range";
import type { SaleRow } from "@/components/ventas/sale-list";
import type { CashRegister, PlanUsageRow } from "@/types/database";

export default async function DashboardPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const timeZone = session.activeCompany.timezone;

  const now = new Date();
  const todayRange = getPeriodRange("today", timeZone, undefined, now);
  const yesterdayRange = getPeriodRange("yesterday", timeZone, undefined, now);
  const thisMonthRange = getPeriodRange("this_month", timeZone, undefined, now);
  const lastMonthRange = getPeriodRange("last_month", timeZone, undefined, now);
  const startOfToday = todayRange.start;
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 86400000);

  const [
    { data: yesterdaySales },
    { data: thisMonthSalesRaw },
    { data: lastMonthSalesRaw },
    { data: thisMonthExpensesRaw },
    { data: lastMonthExpensesRaw },
    { count: customerCount },
    { count: productCount },
    { count: serviceCount },
    { count: totalSalesCount },
    { data: todaySales },
    { data: recentSalesData },
    { data: weekSalesRaw },
    { data: soldItemsRaw },
    { data: trackedProducts },
    { data: openRegisterData },
    { data: lastClosedRegister },
    { data: todayCashMovements },
    { count: pendingOrdersCount },
    { count: todayOrdersCount },
    { count: inDeliveryCount },
    { count: deliveredTodayCount },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("total_cents")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", yesterdayRange.start.toISOString())
      .lt("created_at", yesterdayRange.end.toISOString()),
    supabase
      .from("sales")
      .select("total_cents")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", thisMonthRange.start.toISOString())
      .lt("created_at", thisMonthRange.end.toISOString()),
    supabase
      .from("sales")
      .select("total_cents")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", lastMonthRange.start.toISOString())
      .lt("created_at", lastMonthRange.end.toISOString()),
    supabase
      .from("expenses")
      .select("amount_cents")
      .eq("company_id", companyId)
      .eq("status", "registered")
      .gte("spent_at", thisMonthRange.start.toISOString())
      .lt("spent_at", thisMonthRange.end.toISOString()),
    supabase
      .from("expenses")
      .select("amount_cents")
      .eq("company_id", companyId)
      .eq("status", "registered")
      .gte("spent_at", lastMonthRange.start.toISOString())
      .lt("spent_at", lastMonthRange.end.toISOString()),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "completed"),
    supabase
      .from("sales")
      .select("total_cents")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("sales")
      .select("*, customer:customers(first_name,last_name), user:profiles(first_name,last_name,email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("sales")
      .select("total_cents, created_at")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("sale_items")
      .select("name, quantity, sales!inner(company_id,status)")
      .eq("sales.company_id", companyId)
      .eq("sales.status", "completed"),
    supabase
      .from("products")
      .select("current_stock, minimum_stock")
      .eq("company_id", companyId)
      .eq("track_inventory", true),
    supabase.from("cash_registers").select("*").eq("company_id", companyId).eq("status", "open").maybeSingle(),
    supabase
      .from("cash_registers")
      .select("difference_cents, closed_at")
      .eq("company_id", companyId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cash_movements")
      .select("movement_type, amount_cents")
      .eq("company_id", companyId)
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("status", "in", "(delivered,canceled)"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", startOfToday.toISOString()),
    session.activeCompany.delivery_enabled
      ? supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .in("delivery_status", ["pending_assignment", "assigned", "picked_up", "on_the_way"])
      : Promise.resolve({ count: 0 }),
    session.activeCompany.delivery_enabled
      ? supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("delivery_status", "delivered")
          .gte("updated_at", startOfToday.toISOString())
      : Promise.resolve({ count: 0 }),
  ]);

  const totalCustomers = customerCount ?? 0;
  const totalProducts = productCount ?? 0;
  const totalServices = serviceCount ?? 0;
  const hasAnySale = (totalSalesCount ?? 0) > 0;

  const todaySalesCount = todaySales?.length ?? 0;
  const todaySalesTotalCents = (todaySales ?? []).reduce((sum, s) => sum + s.total_cents, 0);
  const yesterdaySalesTotalCents = (yesterdaySales ?? []).reduce((sum, s) => sum + s.total_cents, 0);

  const thisMonthSalesCount = thisMonthSalesRaw?.length ?? 0;
  const thisMonthSalesTotalCents = (thisMonthSalesRaw ?? []).reduce((sum, s) => sum + s.total_cents, 0);
  const lastMonthSalesTotalCents = (lastMonthSalesRaw ?? []).reduce((sum, s) => sum + s.total_cents, 0);

  const thisMonthExpensesTotalCents = (thisMonthExpensesRaw ?? []).reduce((sum, e) => sum + e.amount_cents, 0);
  const lastMonthExpensesTotalCents = (lastMonthExpensesRaw ?? []).reduce((sum, e) => sum + e.amount_cents, 0);

  const todaySalesDelta = deltaPct(todaySalesTotalCents, yesterdaySalesTotalCents);
  const monthSalesDelta = deltaPct(thisMonthSalesTotalCents, lastMonthSalesTotalCents);
  const monthExpensesDelta = deltaPct(thisMonthExpensesTotalCents, lastMonthExpensesTotalCents);

  const weekSales: WeekSalePoint[] = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(sevenDaysAgo);
    day.setDate(day.getDate() + i);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const total = (weekSalesRaw ?? [])
      .filter((s) => {
        const created = new Date(s.created_at);
        return created >= day && created < dayEnd;
      })
      .reduce((sum, s) => sum + s.total_cents, 0);
    return { day: day.toLocaleDateString("es-CO", { weekday: "short" }), total };
  });

  const topItemsMap = new Map<string, number>();
  for (const item of soldItemsRaw ?? []) {
    topItemsMap.set(item.name, (topItemsMap.get(item.name) ?? 0) + Number(item.quantity));
  }
  const topItems: TopSoldItem[] = [...topItemsMap.entries()]
    .map(([name, unitsSold]) => ({ name, unitsSold }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 4);

  const recentSales = (recentSalesData ?? []) as unknown as SaleRow[];
  const isEmptyAccount = totalCustomers === 0 && totalProducts === 0 && totalServices === 0;

  const trackedProductsList = trackedProducts ?? [];
  const lowStockCount = trackedProductsList.filter((p) => stockStatus(p) === "low").length;
  const outOfStockCount = trackedProductsList.filter((p) => stockStatus(p) === "out").length;

  const openRegister = openRegisterData as CashRegister | null;
  const cashBalanceCents = openRegister
    ? openRegister.opening_amount_cents +
      (todayCashMovements ?? []).reduce((s, m) => s + m.amount_cents, 0)
    : null;
  const lastClosedDifference = lastClosedRegister?.difference_cents ?? 0;

  const { data: planUsageData } = await supabase.rpc("get_plan_usage", { p_company_id: companyId });
  const planUsage = (planUsageData as PlanUsageRow[] | null) ?? [];

  const businessType = session.activeCompany.business_type;
  let verticalWidget: ReactNode = null;

  if (businessType === "moto_wash" || businessType === "workshop") {
    const [{ count: vehicleCount }, { count: openWorkOrders }] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      businessType === "workshop"
        ? supabase
            .from("work_orders")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .not("status", "in", "(delivered,canceled)")
        : Promise.resolve({ count: 0 }),
    ]);
    const stats = [{ label: "vehículos registrados", value: String(vehicleCount ?? 0) }];
    if (businessType === "workshop") {
      stats.push({ label: "órdenes de trabajo abiertas", value: String(openWorkOrders ?? 0) });
    }
    verticalWidget = (
      <VerticalWidgetCard
        icon={Bike}
        title="Vehículos"
        href="/vehiculos"
        linkLabel="Ver vehículos"
        stats={stats}
      />
    );
  } else if (businessType === "barbershop") {
    const todayStr = startOfToday.toISOString().slice(0, 10);
    const { count: todayAppointments } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("appointment_date", todayStr);
    verticalWidget = (
      <VerticalWidgetCard
        icon={CalendarClock}
        title="Agenda"
        href="/agenda"
        linkLabel="Ver agenda"
        stats={[{ label: "citas hoy", value: String(todayAppointments ?? 0) }]}
      />
    );
  } else if (businessType === "laundry") {
    const { count: pendingLaundry } = await supabase
      .from("laundry_orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("status", "in", "(delivered,canceled)");
    verticalWidget = (
      <VerticalWidgetCard
        icon={Shirt}
        title="Lavandería"
        href="/lavanderia"
        linkLabel="Ver órdenes"
        stats={[{ label: "órdenes pendientes", value: String(pendingLaundry ?? 0) }]}
      />
    );
  } else if (businessType === "pet_shop") {
    const { count: petCount } = await supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    verticalWidget = (
      <VerticalWidgetCard
        icon={PawPrint}
        title="Mascotas"
        href="/mascotas"
        linkLabel="Ver mascotas"
        stats={[{ label: "mascotas registradas", value: String(petCount ?? 0) }]}
      />
    );
  } else if (businessType === "food") {
    const { count: kitchenOrdersCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["pending", "confirmed", "preparing"]);
    verticalWidget = (
      <VerticalWidgetCard
        icon={ChefHat}
        title="Cocina"
        href="/cocina"
        linkLabel="Ver cocina"
        stats={[{ label: "pedidos en cocina", value: String(kitchenOrdersCount ?? 0) }]}
      />
    );
  } else if (businessType === "boutique") {
    const [{ data: topSizeRows }, { count: outOfStockVariants }] = await Promise.all([
      supabase.rpc("report_variant_attribute_sales", {
        p_company_id: companyId,
        p_start: thisMonthRange.start.toISOString(),
        p_end: thisMonthRange.end.toISOString(),
        p_attribute_name: "Talla",
      }),
      supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active")
        .lte("stock", 0),
    ]);
    const topSize = (topSizeRows as { attribute_value: string; quantity: number }[] | null)?.[0];
    const stats = [
      ...(topSize ? [{ label: `talla más vendida (${topSize.attribute_value})`, value: `${topSize.quantity}` }] : []),
      { label: "variantes agotadas", value: String(outOfStockVariants ?? 0) },
    ];
    verticalWidget = (
      <VerticalWidgetCard
        icon={Package}
        title="Boutique"
        href="/reportes/productos"
        linkLabel="Ver reporte"
        stats={stats}
      />
    );
  }

  const attentionItems: AttentionItem[] = [
    ...((pendingOrdersCount ?? 0) > 0
      ? [
          {
            id: "orders-pending",
            title: `${pendingOrdersCount} pedido${pendingOrdersCount === 1 ? "" : "s"} pendiente${pendingOrdersCount === 1 ? "" : "s"}`,
            description: "Esperando que los confirmes.",
            href: "/pedidos",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(outOfStockCount > 0
      ? [
          {
            id: "inventory-out",
            title: `${outOfStockCount} producto${outOfStockCount === 1 ? "" : "s"} agotado${outOfStockCount === 1 ? "" : "s"}`,
            description: "No tienen existencias disponibles.",
            href: "/inventario",
            tone: "destructive" as const,
          },
        ]
      : []),
    ...(lowStockCount > 0
      ? [
          {
            id: "inventory-low",
            title: `${lowStockCount} producto${lowStockCount === 1 ? "" : "s"} con stock bajo`,
            description: "Están por debajo de su stock mínimo.",
            href: "/inventario",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(!openRegister
      ? [
          {
            id: "cash-closed",
            title: "Tu caja está cerrada",
            description: "Ábrela para registrar los movimientos de dinero de hoy.",
            href: "/caja",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(lastClosedDifference !== 0
      ? [
          {
            id: "cash-difference",
            title: `Diferencia de ${formatCurrencyCents(Math.abs(lastClosedDifference))} en tu último cierre`,
            description: lastClosedDifference > 0 ? "Sobró dinero al cerrar." : "Faltó dinero al cerrar.",
            href: "/caja/historial",
            tone: "destructive" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8 pb-4">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
          {greeting()}, {displayName(session).split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto es lo que está pasando hoy en {session.activeCompany.name}.
        </p>
      </div>

      {isEmptyAccount && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Todavía no tienes clientes, productos ni servicios
              </p>
              <p className="text-sm text-muted-foreground">
                Empieza agregando tu primer cliente para construir tu negocio en bizko.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/clientes">+ Crear cliente</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Ventas de hoy"
          value={formatCurrencyCents(todaySalesTotalCents)}
          icon={DollarSign}
          deltaPct={todaySalesDelta}
          hint={todaySalesDelta !== undefined ? "vs. ayer" : `${todaySalesCount} venta${todaySalesCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Ventas del mes"
          value={formatCurrencyCents(thisMonthSalesTotalCents)}
          icon={DollarSign}
          deltaPct={monthSalesDelta}
          hint={monthSalesDelta !== undefined ? "vs. mes anterior" : `${thisMonthSalesCount} venta${thisMonthSalesCount === 1 ? "" : "s"}`}
        />
        <StatCard label="Número de ventas" value={String(thisMonthSalesCount)} icon={Receipt} hint="este mes" />
        <StatCard
          label="Pedidos pendientes"
          value={String(pendingOrdersCount ?? 0)}
          icon={ClipboardList}
        />
        <StatCard
          label="Gastos del mes"
          value={formatCurrencyCents(thisMonthExpensesTotalCents)}
          icon={Receipt}
          deltaPct={monthExpensesDelta}
          hint={monthExpensesDelta !== undefined ? "vs. mes anterior" : undefined}
        />
        <StatCard
          label="Saldo de caja"
          value={cashBalanceCents !== null ? formatCurrencyCents(cashBalanceCents) : "Cerrada"}
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clientes" value={String(totalCustomers)} icon={Users} />
        <StatCard label="Productos" value={String(totalProducts)} icon={Package} />
        <StatCard label="Servicios" value={String(totalServices)} icon={Wrench} />
        <StatCard label="Pedidos de hoy" value={String(todayOrdersCount ?? 0)} icon={ClipboardList} />
      </div>

      <section>
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
          Acciones rápidas
        </h2>
        <QuickActions />
      </section>

      <section>
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
          Necesita tu atención
        </h2>
        <AttentionPanel items={attentionItems} />
      </section>

      {trackedProductsList.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-foreground">Inventario</h2>
            <Link href="/inventario" className="text-sm font-medium text-brand hover:underline">
              Ver inventario
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Boxes className="size-4 text-muted-foreground" />
              {trackedProductsList.length} producto{trackedProductsList.length === 1 ? "" : "s"}
            </span>
            {lowStockCount > 0 && (
              <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning-foreground">
                ⚠️ {lowStockCount} stock bajo
              </span>
            )}
            {outOfStockCount > 0 && (
              <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                🔴 {outOfStockCount} agotado{outOfStockCount === 1 ? "" : "s"}
              </span>
            )}
            {lowStockCount === 0 && outOfStockCount === 0 && (
              <span className="text-xs text-muted-foreground">Todo el inventario está en buen estado.</span>
            )}
          </div>
        </section>
      )}

      {verticalWidget}

      <PlanUsageCard plan={session.activePlan} usage={planUsage} />

      {session.activeCompany.delivery_enabled && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-foreground">Delivery</h2>
            <Link href="/delivery" className="text-sm font-medium text-brand hover:underline">
              Ver delivery
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Bike className="size-4 text-muted-foreground" />
              {inDeliveryCount ?? 0} en camino
            </span>
            <span className="text-sm text-muted-foreground">
              {deliveredTodayCount ?? 0} entregas hoy
            </span>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Últimas ventas
          </h2>
          {hasAnySale && (
            <Link href="/ventas" className="text-sm font-medium text-brand hover:underline">
              Ver todas
            </Link>
          )}
        </div>
        {hasAnySale ? (
          <RecentSales sales={recentSales} />
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="Comienza registrando tu primera venta"
            description="Cuando registres una venta, aparecerá aquí."
            action={
              <Button asChild>
                <Link href="/ventas/nuevo">Crear venta</Link>
              </Button>
            }
          />
        )}
      </section>

      {hasAnySale && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-foreground">
            <Receipt className="size-4 text-muted-foreground" /> Rendimiento
          </h2>
          <PerformancePanel weekSales={weekSales} topItems={topItems} />
        </section>
      )}
    </div>
  );
}
