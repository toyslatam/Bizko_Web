import { LifeBuoy, AlertCircle, MessageCircle, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const SECTIONS: { icon: LucideIcon; title: string }[] = [
  { icon: LifeBuoy, title: "Empresas que necesitan ayuda" },
  { icon: AlertCircle, title: "Incidencias" },
  { icon: MessageCircle, title: "Solicitudes" },
];

export default function AdminSupportPage() {
  return (
    <div>
      <PageHeader
        title="Soporte"
        description="Solicitudes e incidencias de negocios (próximamente)."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SECTIONS.map(({ icon: Icon, title }) => (
          <div
            key={title}
            className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center"
          >
            <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Icon className="size-6" />
            </span>
            <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta sección estará disponible próximamente.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
