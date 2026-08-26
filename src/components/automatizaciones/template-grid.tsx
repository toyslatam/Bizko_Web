"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTOMATION_TEMPLATES } from "@/lib/automations";
import { activateTemplateAction } from "@/app/(app)/automatizaciones/actions";

export function TemplateGrid({ activeTemplateKeys }: { activeTemplateKeys: string[] }) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

  async function handleActivate(key: string) {
    setLoadingKey(key);
    const result = await activateTemplateAction(key);
    setLoadingKey(null);

    if ("error" in result) {
      toast.error("No pudimos activar la plantilla", { description: result.error });
      return;
    }
    toast.success("Automatización activada.");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {AUTOMATION_TEMPLATES.map((template) => {
        const alreadyActive = activeTemplateKeys.includes(template.key);
        return (
          <div key={template.key} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Zap className="size-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">{template.name}</p>
            <p className="mt-1 flex-1 text-xs text-muted-foreground">{template.description}</p>
            <Button
              className="mt-3"
              size="sm"
              variant={alreadyActive ? "outline" : "default"}
              disabled={alreadyActive || loadingKey === template.key}
              onClick={() => handleActivate(template.key)}
            >
              {alreadyActive ? "Ya activada" : loadingKey === template.key ? "Activando..." : "Activar plantilla"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
