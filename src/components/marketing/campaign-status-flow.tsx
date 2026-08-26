"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  advanceCampaignAction,
  retreatCampaignAction,
  setCampaignScheduleAction,
} from "@/app/(app)/marketing/actions";
import { CAMPAIGN_STATUS_FLOW, CAMPAIGN_STATUS_LABELS, nextCampaignStatus, previousCampaignStatus } from "@/lib/marketing";
import type { MarketingCampaign } from "@/types/database";

export function CampaignStatusFlow({
  campaign,
  canManage,
}: {
  campaign: MarketingCampaign;
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [scheduleDraft, setScheduleDraft] = React.useState("");
  const [asking, setAsking] = React.useState(false);

  const currentIndex = CAMPAIGN_STATUS_FLOW.indexOf(campaign.status);
  const next = nextCampaignStatus(campaign.status);
  const prev = previousCampaignStatus(campaign.status);
  const needsScheduleToAdvance = next === "scheduled" && !campaign.scheduled_at;

  async function handleAdvanceClick() {
    if (needsScheduleToAdvance && !asking) {
      setAsking(true);
      return;
    }

    if (needsScheduleToAdvance) {
      if (!scheduleDraft) {
        toast.error("Elige una fecha y hora para programar la campaña.");
        return;
      }
      setSaving(true);
      const scheduleResult = await setCampaignScheduleAction(
        campaign.id,
        new Date(scheduleDraft).toISOString(),
      );
      if ("error" in scheduleResult) {
        toast.error(scheduleResult.error);
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    const result = await advanceCampaignAction(campaign.id, campaign.status);
    setSaving(false);
    setAsking(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`Campaña movida a "${CAMPAIGN_STATUS_LABELS[result.campaign.status]}".`);
    router.refresh();
  }

  async function handleRetreatClick() {
    setSaving(true);
    const result = await retreatCampaignAction(campaign.id, campaign.status);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`Campaña movida a "${CAMPAIGN_STATUS_LABELS[result.campaign.status]}".`);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {CAMPAIGN_STATUS_FLOW.map((status, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <div key={status} className="flex shrink-0 items-center">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                  active
                    ? "bg-brand text-white"
                    : done
                      ? "bg-brand/10 text-brand"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done && <Check className="size-3" />}
                {CAMPAIGN_STATUS_LABELS[status]}
              </div>
              {idx < CAMPAIGN_STATUS_FLOW.length - 1 && (
                <div className={cn("mx-1 h-px w-4 shrink-0", done ? "bg-brand/40" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {campaign.scheduled_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          Programada para {new Date(campaign.scheduled_at).toLocaleString("es-CO")}
        </p>
      )}

      {canManage && (
        <>
          {asking && needsScheduleToAdvance && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3">
              <Label htmlFor="scheduleAt">Fecha y hora de publicación</Label>
              <Input
                id="scheduleAt"
                type="datetime-local"
                value={scheduleDraft}
                onChange={(e) => setScheduleDraft(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!prev || saving}
              onClick={handleRetreatClick}
            >
              <ChevronLeft /> Retroceder
            </Button>
            <Button type="button" size="sm" disabled={!next || saving} onClick={handleAdvanceClick}>
              {saving ? "Guardando..." : asking && needsScheduleToAdvance ? "Confirmar y avanzar" : "Avanzar"}{" "}
              <ChevronRight />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
