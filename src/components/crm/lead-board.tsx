"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { moveLeadStageAction } from "@/app/(app)/crm/leads/actions";
import { LEAD_SOURCE_LABELS, formatDaysSince } from "@/lib/crm";
import { formatCurrencyCents } from "@/lib/format";
import type { CrmPipelineStage, Lead } from "@/types/database";

export function LeadBoard({ stages, leads }: { stages: CrmPipelineStage[]; leads: Lead[] }) {
  const router = useRouter();
  const [movingId, setMovingId] = React.useState<string | null>(null);
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  async function handleMove(leadId: string, stageId: string) {
    setMovingId(leadId);
    const result = await moveLeadStageAction(leadId, stageId);
    setMovingId(null);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Sin leads todavía"
        description="Los leads que agregues aparecerán organizados por etapa del pipeline."
      />
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
      {sortedStages.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage_id === stage.id);
        return (
          <div key={stage.id} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/40 p-2">
            <div className="flex items-center justify-between px-1.5 py-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground">{stage.name}</p>
                {stage.is_won && <Badge variant="default" className="text-[10px]">Ganado</Badge>}
                {stage.is_lost && <Badge variant="destructive" className="text-[10px]">Perdido</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {stageLeads.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <Link href={`/crm/leads/${lead.id}`} className="block">
                    <p className="truncate text-sm font-medium text-foreground hover:underline">{lead.name}</p>
                    {lead.company_name && (
                      <p className="truncate text-xs text-muted-foreground">{lead.company_name}</p>
                    )}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
                    {lead.potential_value_cents != null && (
                      <span className="text-xs font-medium text-foreground">
                        {formatCurrencyCents(lead.potential_value_cents)}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {formatDaysSince(lead.last_interaction_at)}
                  </p>

                  <Select
                    value={lead.stage_id}
                    onValueChange={(v) => handleMove(lead.id, v)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="mt-2 w-full"
                      disabled={movingId === lead.id}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
