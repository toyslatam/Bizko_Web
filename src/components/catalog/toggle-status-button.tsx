"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { EntityStatus } from "@/types/database";

interface ToggleStatusButtonProps {
  status: EntityStatus;
  entityLabel: string;
  onToggle: (nextStatus: EntityStatus) => Promise<{ ok: true } | { error: string }>;
}

/** Botón activar/desactivar reutilizable (clientes, productos, servicios). */
export function ToggleStatusButton({ status, entityLabel, onToggle }: ToggleStatusButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const isActive = status === "active";

  async function run(next: EntityStatus) {
    setLoading(true);
    const result = await onToggle(next);
    setLoading(false);
    setConfirmOpen(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(next === "active" ? `${entityLabel} activado.` : `${entityLabel} desactivado.`);
    router.refresh();
  }

  if (isActive) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
          <PowerOff /> Desactivar
        </Button>
        <ConfirmationDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`¿Desactivar este ${entityLabel.toLowerCase()}?`}
          description="No aparecerá en listados activos, pero no se elimina su información."
          confirmLabel="Desactivar"
          destructive
          loading={loading}
          onConfirm={() => run("inactive")}
        />
      </>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={() => run("active")}>
      <Power /> Activar
    </Button>
  );
}
