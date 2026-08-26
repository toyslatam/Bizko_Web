"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteVehicleAction } from "@/app/(app)/vehiculos/actions";

export function DeleteVehicleButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await deleteVehicleAction(vehicleId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Vehículo eliminado.");
    router.push("/vehiculos");
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
        title="¿Eliminar este vehículo?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar vehículo"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
