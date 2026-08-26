"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { SUSPEND_REASONS } from "@/lib/admin";
import { daysUntil } from "@/lib/plans";
import {
  changeCompanyPlanAction,
  endTrialAction,
  extendTrialAction,
  reactivateCompanyAction,
  startTrialAction,
  suspendCompanyAction,
} from "@/app/admin/empresas/actions";
import type { Plan, SubscriptionStatus } from "@/types/database";

interface CompanyActionsPanelProps {
  companyId: string;
  currentPlanId: string | null;
  currentStatus: SubscriptionStatus | null;
  plans: Plan[];
  trialEndsAt: string | null;
}

export function CompanyActionsPanel({
  companyId,
  currentPlanId,
  currentStatus,
  plans,
  trialEndsAt,
}: CompanyActionsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const [planDialogOpen, setPlanDialogOpen] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState(currentPlanId ?? "");
  const [planReason, setPlanReason] = React.useState("");

  const [extendDialogOpen, setExtendDialogOpen] = React.useState(false);
  const [extendDays, setExtendDays] = React.useState("7");

  const [suspendDialogOpen, setSuspendDialogOpen] = React.useState(false);
  const [suspendReason, setSuspendReason] = React.useState("");

  const [startTrialConfirmOpen, setStartTrialConfirmOpen] = React.useState(false);
  const [endTrialConfirmOpen, setEndTrialConfirmOpen] = React.useState(false);
  const [reactivateConfirmOpen, setReactivateConfirmOpen] = React.useState(false);

  const remainingDays = daysUntil(trialEndsAt);
  const isSuspended = currentStatus === "suspended";

  async function handleChangePlan() {
    if (!selectedPlanId) return;
    setLoading(true);
    const result = await changeCompanyPlanAction(companyId, selectedPlanId, planReason);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Plan actualizado.");
    setPlanDialogOpen(false);
    setPlanReason("");
    router.refresh();
  }

  async function handleStartTrial() {
    setLoading(true);
    const result = await startTrialAction(companyId);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Prueba iniciada.");
    setStartTrialConfirmOpen(false);
    router.refresh();
  }

  async function handleExtendTrial() {
    const days = Number(extendDays);
    setLoading(true);
    const result = await extendTrialAction(companyId, days);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Prueba extendida.");
    setExtendDialogOpen(false);
    router.refresh();
  }

  async function handleEndTrial() {
    setLoading(true);
    const result = await endTrialAction(companyId);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Prueba finalizada.");
    setEndTrialConfirmOpen(false);
    router.refresh();
  }

  async function handleSuspend() {
    const reasonLabel = SUSPEND_REASONS.find((r) => r.value === suspendReason)?.label ?? suspendReason;
    setLoading(true);
    const result = await suspendCompanyAction(companyId, reasonLabel);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Empresa suspendida.");
    setSuspendDialogOpen(false);
    setSuspendReason("");
    router.refresh();
  }

  async function handleReactivate() {
    setLoading(true);
    const result = await reactivateCompanyAction(companyId);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Empresa reactivada.");
    setReactivateConfirmOpen(false);
    router.refresh();
  }

  function handleViewAccount() {
    toast.info(
      "Vista de cuenta preparada — el acceso completo como el negocio se habilitará más adelante, con registro de auditoría.",
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setPlanDialogOpen(true)}>
          Cambiar plan
        </Button>
        <Button variant="outline" size="sm" onClick={handleViewAccount}>
          Ver cuenta
        </Button>
        {isSuspended ? (
          <Button variant="outline" size="sm" onClick={() => setReactivateConfirmOpen(true)}>
            Reactivar empresa
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setSuspendDialogOpen(true)}>
            Suspender empresa
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prueba</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStartTrialConfirmOpen(true)}>
            Iniciar prueba
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExtendDialogOpen(true)}>
            Extender prueba
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEndTrialConfirmOpen(true)}>
            Finalizar prueba
          </Button>
          {remainingDays !== null && remainingDays > 0 && (
            <span className="text-xs text-muted-foreground">{remainingDays} días restantes</span>
          )}
        </div>
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar plan</DialogTitle>
            <DialogDescription>
              Este cambio modifica las funcionalidades y límites de la empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nuevo plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={planReason}
                onChange={(e) => setPlanReason(e.target.value)}
                placeholder="Ej. Cliente solicitó actualizar su plan."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={loading || !selectedPlanId} onClick={handleChangePlan}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extender prueba</DialogTitle>
            <DialogDescription>Agrega días adicionales al período de prueba.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Días a extender</Label>
            <Input
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={loading} onClick={handleExtendTrial}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender empresa</DialogTitle>
            <DialogDescription>
              La empresa perderá acceso a la operación hasta que sea reactivada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={suspendReason} onValueChange={setSuspendReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                {SUSPEND_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={loading || !suspendReason} onClick={handleSuspend}>
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={startTrialConfirmOpen}
        onOpenChange={setStartTrialConfirmOpen}
        title="Iniciar prueba"
        description="Se iniciará un período de prueba de 14 días para esta empresa."
        loading={loading}
        onConfirm={handleStartTrial}
      />

      <ConfirmationDialog
        open={endTrialConfirmOpen}
        onOpenChange={setEndTrialConfirmOpen}
        title="Finalizar prueba"
        description="La suscripción pasará a estado activo."
        loading={loading}
        onConfirm={handleEndTrial}
      />

      <ConfirmationDialog
        open={reactivateConfirmOpen}
        onOpenChange={setReactivateConfirmOpen}
        title="Reactivar empresa"
        description="La empresa recuperará el acceso a la operación."
        loading={loading}
        onConfirm={handleReactivate}
      />
    </div>
  );
}
