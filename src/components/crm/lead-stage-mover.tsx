"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveLeadStageAction } from "@/app/(app)/crm/leads/actions";
import type { CrmPipelineStage } from "@/types/database";

export function LeadStageMover({
  leadId,
  stages,
  currentStageId,
}: {
  leadId: string;
  stages: CrmPipelineStage[];
  currentStageId: string;
}) {
  const router = useRouter();
  const [moving, setMoving] = React.useState(false);
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  async function handleChange(stageId: string) {
    if (stageId === currentStageId) return;
    setMoving(true);
    const result = await moveLeadStageAction(leadId, stageId);
    setMoving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Lead movido de etapa.");
    router.refresh();
  }

  return (
    <Select value={currentStageId} onValueChange={handleChange}>
      <SelectTrigger disabled={moving} className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sorted.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
