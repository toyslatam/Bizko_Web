"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setAutomationStatusAction } from "@/app/(app)/automatizaciones/actions";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_TRIGGER_LABELS,
} from "@/lib/automations";
import type { Automation } from "@/types/database";

export function AutomationList({ automations }: { automations: Automation[] }) {
  const router = useRouter();

  async function toggle(automation: Automation) {
    const next = automation.status === "active" ? "paused" : "active";
    const result = await setAutomationStatusAction(automation.id, next);
    if ("error" in result) {
      toast.error("No pudimos actualizar la automatización", { description: result.error });
      return;
    }
    toast.success(next === "active" ? "Automatización activada." : "Automatización pausada.");
    router.refresh();
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {automations.map((automation) => (
        <div key={automation.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{automation.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {AUTOMATION_TRIGGER_LABELS[automation.trigger_type]} → {AUTOMATION_ACTION_LABELS[automation.action_type]}
            </p>
            {automation.status === "error" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3" /> Esta automatización necesita atención.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={automation.status === "active" ? "default" : "outline"}>
              {AUTOMATION_STATUS_LABELS[automation.status]}
            </Badge>
            {automation.status !== "error" && (
              <Button variant="outline" size="sm" onClick={() => toggle(automation)}>
                {automation.status === "active" ? <Pause /> : <Play />}
                {automation.status === "active" ? "Pausar" : "Activar"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
