"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { voidSaleAction } from "@/app/(app)/ventas/actions";

export function VoidSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await voidSaleAction(saleId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Venta anulada.");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Ban /> Anular venta
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Anular esta venta?"
        description="La venta quedará marcada como anulada. No se elimina, solo se revierte su estado."
        confirmLabel="Anular venta"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
