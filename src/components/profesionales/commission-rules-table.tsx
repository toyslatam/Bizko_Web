import { formatCurrencyCents } from "@/lib/format";
import { CommissionRuleDialog } from "@/components/profesionales/commission-rule-dialog";
import { DeleteCommissionRuleButton } from "@/components/profesionales/delete-commission-rule-button";
import type { CommissionRule, Service } from "@/types/database";

function formatCommissionValue(rule: CommissionRule): string {
  return rule.commission_type === "fixed" ? formatCurrencyCents(rule.value) : `${rule.value}%`;
}

export function CommissionRulesTable({
  professionalId,
  assignedServices,
  rules,
}: {
  professionalId: string;
  assignedServices: Service[];
  rules: CommissionRule[];
}) {
  const defaultRule = rules.find((r) => r.service_id === null);
  const rulesByService = new Map(rules.filter((r) => r.service_id !== null).map((r) => [r.service_id, r]));

  const rows = [
    { key: "default", serviceId: null as string | null, label: "Comisión por defecto", rule: defaultRule },
    ...assignedServices.map((service) => ({
      key: service.id,
      serviceId: service.id,
      label: service.name,
      rule: rulesByService.get(service.id),
    })),
  ];

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{row.label}</p>
            <p className="text-xs text-muted-foreground">
              {row.rule ? formatCommissionValue(row.rule) : "Sin configurar"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CommissionRuleDialog
              professionalId={professionalId}
              serviceId={row.serviceId}
              label={row.label}
              rule={row.rule}
            />
            {row.rule && (
              <DeleteCommissionRuleButton ruleId={row.rule.id} professionalId={professionalId} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
