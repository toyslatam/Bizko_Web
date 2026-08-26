"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { voidExpenseAction } from "@/app/(app)/gastos/actions";

export function VoidExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await voidExpenseAction(expenseId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Gasto anulado.");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} title="Anular gasto">
        <Ban className="text-destructive" />
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Anular este gasto?"
        description="Si generó un egreso de caja, se revertirá automáticamente."
        confirmLabel="Anular gasto"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
