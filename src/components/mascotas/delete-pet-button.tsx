"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deletePetAction } from "@/app/(app)/mascotas/actions";

export function DeletePetButton({ petId }: { petId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await deletePetAction(petId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Mascota eliminada.");
    router.push("/mascotas");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="text-destructive" /> Eliminar
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar esta mascota?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar mascota"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
