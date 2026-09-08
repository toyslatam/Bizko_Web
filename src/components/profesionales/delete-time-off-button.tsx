"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteTimeOffAction } from "@/app/(app)/profesionales/actions";

export function DeleteTimeOffButton({
  timeOffId,
  professionalId,
}: {
  timeOffId: string;
  professionalId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await deleteTimeOffAction(timeOffId, professionalId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Bloqueo eliminado.");
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
        title="¿Eliminar este bloqueo?"
        description="El profesional volverá a estar disponible en ese horario."
        confirmLabel="Eliminar bloqueo"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
