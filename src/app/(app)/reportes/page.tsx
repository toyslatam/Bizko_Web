import { redirect } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  Package,
  Users,
  Boxes,
  Wallet,
  Receipt,
  ClipboardList,
  Scale,
  UtensilsCrossed,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

interface ReportCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const REPORT_CARDS: ReportCard[] = [
  { href: "/reportes/ventas", icon: DollarSign, title: "Ventas", description: "Total vendido, ticket promedio y métodos de pago." },
  { href: "/reportes/productos", icon: Package, title: "Productos y servicios", description: "Qué vendes más y qué genera más ingresos." },
  { href: "/reportes/clientes", icon: Users, title: "Clientes", description: "Quiénes compran más y quiénes no han vuelto." },
  { href: "/reportes/inventario", icon: Boxes, title: "Inventario", description: "Stock disponible, bajo, agotado y rotación." },
  { href: "/reportes/caja", icon: Wallet, title: "Caja", description: "Ingresos, egresos y diferencias de cierre." },
  { href: "/reportes/gastos", icon: Receipt, title: "Gastos", description: "Gastos por categoría y resultado operativo." },
  { href: "/reportes/pedidos", icon: ClipboardList, title: "Pedidos y delivery", description: "Pedidos por estado, tipo de entrega y zona." },
];

const FOOD_REPORT_CARD: ReportCard = {
  href: "/reportes/restaurante",
  icon: UtensilsCrossed,
  title: "Restaurante",
  description: "Horas pico, tipo de pedido, combos y tiempo de preparación.",
};

const BARBERSHOP_REPORT_CARD: ReportCard = {
  href: "/reportes/peluqueria",
  icon: Scissors,
  title: "Peluquería",
  description: "Comisiones por profesional y embudo de citas.",
};

export default async function ReportesPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.activeMembership || !can(session.activeMembership.role, "reportes.ver")) {
    redirect("/dashboard");
  }

  const cards =
    session.activeCompany.business_type === "food"
      ? [...REPORT_CARDS, FOOD_REPORT_CARD]
      : session.activeCompany.business_type === "barbershop"
        ? [...REPORT_CARDS, BARBERSHOP_REPORT_CARD]
        : REPORT_CARDS;

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Entiende cómo va tu negocio con datos reales."
      />

      <div className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Scale className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Estos reportes son una guía operativa de tu negocio, no reemplazan la contabilidad
          formal ni una declaración fiscal.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/50 hover:bg-brand/5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <card.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
