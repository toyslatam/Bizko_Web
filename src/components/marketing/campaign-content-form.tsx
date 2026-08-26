"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addCampaignContentAction } from "@/app/(app)/marketing/actions";
import { CAMPAIGN_CONTENT_TYPE_LABELS } from "@/lib/marketing";
import { CHANNEL_TYPE_LABELS, CHANNEL_TYPES } from "@/lib/crm-channels";
import type { CampaignContentType, CrmChannelType } from "@/types/database";

const CONTENT_TYPES = Object.keys(CAMPAIGN_CONTENT_TYPE_LABELS) as CampaignContentType[];

export function CampaignContentForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [channel, setChannel] = React.useState<CrmChannelType | "none">("none");
  const [contentType, setContentType] = React.useState<CampaignContentType>("post");
  const [body, setBody] = React.useState("");
  const [mediaUrl, setMediaUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await addCampaignContentAction(campaignId, {
      channel: channel === "none" ? null : channel,
      contentType,
      body,
      mediaUrl: mediaUrl || null,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      if (result.fieldErrors?.body) setError(result.fieldErrors.body);
      return;
    }

    toast.success("Contenido agregado.");
    setBody("");
    setMediaUrl("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo de contenido</Label>
          <Select value={contentType} onValueChange={(v) => setContentType(v as CampaignContentType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CAMPAIGN_CONTENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Canal (opcional)</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as CrmChannelType | "none")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin canal específico</SelectItem>
              {CHANNEL_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_TYPE_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contentBody">Contenido</Label>
        <Textarea
          id="contentBody"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el texto de esta pieza..."
          rows={4}
          aria-invalid={Boolean(error)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contentMediaUrl">URL de imagen o video (opcional)</Label>
        <Input
          id="contentMediaUrl"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Agregar contenido"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button type="button" variant="outline" disabled>
                <Sparkles /> Generar con IA
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Próximamente — requiere conectar un proveedor de IA.</TooltipContent>
        </Tooltip>
      </div>
    </form>
  );
}
