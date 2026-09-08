"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteGalleryItemAction } from "@/app/(app)/galeria/actions";

export function DeleteGalleryItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await deleteGalleryItemAction(itemId);
    setLoading(false);
    setOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Foto eliminada.");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-background/90 backdrop-blur"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="text-destructive" /> Eliminar
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar esta foto?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar foto"
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
