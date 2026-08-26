"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductCombobox } from "@/components/inventario/product-combobox";
import { createCampaignAction } from "@/app/(app)/marketing/actions";
import { CAMPAIGN_AUDIENCE_LABELS, CAMPAIGN_OBJECTIVE_LABELS } from "@/lib/marketing";
import { CHANNEL_TYPE_LABELS, CHANNEL_TYPES } from "@/lib/crm-channels";
import type {
  CampaignAudienceType,
  CampaignObjective,
  CrmChannelType,
  MarketingSegment,
  Product,
  ProductCategory,
} from "@/types/database";

const OBJECTIVES = Object.keys(CAMPAIGN_OBJECTIVE_LABELS) as CampaignObjective[];
const AUDIENCE_TYPES = Object.keys(CAMPAIGN_AUDIENCE_LABELS) as CampaignAudienceType[];

export function CampaignFormDialog({
  segments,
  categories,
  products,
}: {
  segments: MarketingSegment[];
  categories: ProductCategory[];
  products: Product[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [objective, setObjective] = React.useState<CampaignObjective>("generate_leads");
  const [audienceType, setAudienceType] = React.useState<CampaignAudienceType>("all_customers");
  const [segmentId, setSegmentId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [channels, setChannels] = React.useState<CrmChannelType[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function reset() {
    setName("");
    setObjective("generate_leads");
    setAudienceType("all_customers");
    setSegmentId("");
    setCategoryId("");
    setProductId("");
    setChannels([]);
    setErrors({});
  }

  function toggleChannel(channel: CrmChannelType) {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    let audienceConfig: Record<string, unknown> = {};
    if (audienceType === "custom_segment") {
      if (!segmentId) {
        setErrors({ audience: "Selecciona un segmento." });
        return;
      }
      audienceConfig = { segment_id: segmentId };
    } else if (audienceType === "category_buyers") {
      if (!categoryId) {
        setErrors({ audience: "Selecciona una categoría." });
        return;
      }
      audienceConfig = { category_id: categoryId };
    } else if (audienceType === "product_buyers") {
      if (!productId) {
        setErrors({ audience: "Selecciona un producto." });
        return;
      }
      audienceConfig = { product_id: productId };
    }

    setSaving(true);
    const result = await createCampaignAction({
      name,
      objective,
      audienceType,
      audienceConfig,
      channels,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      if (result.fieldErrors) setErrors(result.fieldErrors);
      return;
    }

    toast.success("Campaña creada.");
    setOpen(false);
    reset();
    router.push(`/marketing/campanas/${result.id}`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nueva campaña
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva campaña</DialogTitle>
            <DialogDescription>
              Define el objetivo, la audiencia y los canales de tu campaña.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaignName">Nombre</Label>
              <Input
                id="campaignName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Descuento de temporada"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Objetivo</Label>
              <Select value={objective} onValueChange={(v) => setObjective(v as CampaignObjective)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {CAMPAIGN_OBJECTIVE_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Audiencia</Label>
              <Select
                value={audienceType}
                onValueChange={(v) => setAudienceType(v as CampaignAudienceType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {CAMPAIGN_AUDIENCE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.audience && <p className="text-xs text-destructive">{errors.audience}</p>}
            </div>

            {audienceType === "custom_segment" && (
              <div className="space-y-1.5">
                <Label>Segmento</Label>
                {segments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tienes segmentos todavía. Crea uno en la sección de Segmentos.
                  </p>
                ) : (
                  <Select value={segmentId} onValueChange={setSegmentId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {audienceType === "category_buyers" && (
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {audienceType === "product_buyers" && (
              <div className="space-y-1.5">
                <Label>Producto</Label>
                <ProductCombobox products={products} value={productId} onChange={setProductId} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Canales</Label>
              <div className="grid grid-cols-2 gap-2">
                {CHANNEL_TYPES.map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={channels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                    />
                    {CHANNEL_TYPE_LABELS[channel]}
                  </label>
                ))}
              </div>
              {errors.channels && <p className="text-xs text-destructive">{errors.channels}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear campaña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
