"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerConversationAction, type RegisterConversationInput } from "@/app/(app)/crm/bandeja/actions";
import { CHANNEL_TYPE_LABELS, CHANNEL_TYPES } from "@/lib/crm-channels";

const EMPTY: RegisterConversationInput = {
  contactName: "",
  channelType: "whatsapp",
  contactHandle: "",
  message: "",
};

export function ConversationRegisterDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<RegisterConversationInput>(EMPTY);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await registerConversationAction(values);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Conversación registrada correctamente.");
    setOpen(false);
    setValues(EMPTY);
    router.push(`/crm/bandeja/${result.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Registrar conversación
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar conversación</DialogTitle>
          <DialogDescription>
            Deja constancia de una conversación que tuviste por fuera de bizko, ej. una llamada o
            un chat en persona.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Nombre del contacto</Label>
            <Input
              id="contactName"
              value={values.contactName}
              onChange={(e) => setValues((v) => ({ ...v, contactName: e.target.value }))}
              placeholder="Ej. María Pérez"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select
                value={values.channelType}
                onValueChange={(v) =>
                  setValues((val) => ({ ...val, channelType: v as RegisterConversationInput["channelType"] }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNEL_TYPE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactHandle">Teléfono / usuario</Label>
              <Input
                id="contactHandle"
                value={values.contactHandle}
                onChange={(e) => setValues((v) => ({ ...v, contactHandle: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Qué dijo o pidió el contacto</Label>
            <Textarea
              id="message"
              rows={4}
              value={values.message}
              onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
              placeholder="Ej. Preguntó por el horario de entrega..."
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
