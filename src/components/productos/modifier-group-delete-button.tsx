"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export function ModifierGroupDeleteButton({
  onDelete,
}: {
  onDelete: () => Promise<{ ok: true } | { error: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await onDelete();
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Grupo de modificadores eliminado.");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar este grupo de modificadores?"
        description="Se eliminará junto con todas sus opciones. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
