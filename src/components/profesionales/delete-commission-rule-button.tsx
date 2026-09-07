"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteCommissionRuleAction } from "@/app/(app)/profesionales/actions";

export function DeleteCommissionRuleButton({
  ruleId,
  professionalId,
}: {
  ruleId: string;
  professionalId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await deleteCommissionRuleAction(ruleId, professionalId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Comisión eliminada.");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 className="text-destructive" />
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar esta comisión?"
        description="El profesional dejará de tener una comisión configurada para este ítem."
        confirmLabel="Eliminar comisión"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
