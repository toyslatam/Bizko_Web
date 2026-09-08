"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Store, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateCompanyAction,
  updateCompanyLogoAction,
  updateCompanyBannerAction,
  updateCompanyAccentColorAction,
  updateCompanySlugAction,
  updateFeatureToggleAction,
} from "@/app/(app)/configuracion/actions";
import { uploadCompanyFile } from "@/lib/storage";
import { getBusinessModule } from "@/modules/registry";
import { getToggleableFeaturesForBusiness } from "@/lib/features";
import { Switch } from "@/components/ui/switch";
import type { Company } from "@/types/database";

const DEFAULT_ACCENT_COLOR = "#8b7cf6";

export function CompanySettingsForm({
  company,
  canEdit,
  featureToggles,
}: {
  company: Company;
  canEdit: boolean;
  featureToggles: Record<string, boolean>;
}) {
  const businessModule = getBusinessModule(company.business_type);
  const toggleableFeatures = getToggleableFeaturesForBusiness(company.business_type);
  const [values, setValues] = React.useState({
    name: company.name,
    phone: company.phone ?? "",
    email: company.email ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    description: company.description ?? "",
    businessHours: company.business_hours ?? "",
    whatsappNumber: company.whatsapp_number ?? "",
  });
  const [logoUrl, setLogoUrl] = React.useState(company.logo_url);
  const [bannerUrl, setBannerUrl] = React.useState(company.banner_url);
  const [accentColor, setAccentColor] = React.useState(company.accent_color ?? DEFAULT_ACCENT_COLOR);
  const [hasCustomColor, setHasCustomColor] = React.useState(Boolean(company.accent_color));
  const [savingColor, setSavingColor] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingBanner, setUploadingBanner] = React.useState(false);
  const accentColorTimeout = React.useRef<number | undefined>(undefined);

  async function persistAccentColor(color: string | null) {
    setSavingColor(true);
    const result = await updateCompanyAccentColorAction(company.id, color);
    setSavingColor(false);
    if ("error" in result) {
      toast.error("No pudimos guardar el color", { description: result.error });
      return;
    }
    setHasCustomColor(color !== null);
    toast.success(color ? "Color actualizado." : "Color restablecido al de bizko.");
  }

  function handleAccentColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const color = e.target.value;
    setAccentColor(color);
    window.clearTimeout(accentColorTimeout.current);
    accentColorTimeout.current = window.setTimeout(() => persistAccentColor(color), 500);
  }

  function handleResetAccentColor() {
    window.clearTimeout(accentColorTimeout.current);
    setAccentColor(DEFAULT_ACCENT_COLOR);
    persistAccentColor(null);
  }

  function patch<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await updateCompanyAction({ companyId: company.id, ...values });
    setSaving(false);

    if ("error" in result) {
      toast.error("No pudimos guardar los cambios", { description: result.error });
      return;
    }
    toast.success("Tu negocio fue actualizado correctamente.");
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadCompanyFile("logos", company.id, file);
      const result = await updateCompanyLogoAction(company.id, url);
      if ("error" in result) throw new Error(result.error);
      setLogoUrl(url);
      toast.success("Logo actualizado.");
    } catch (err) {
      toast.error("No pudimos subir el logo", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const url = await uploadCompanyFile("logos", company.id, file);
      const result = await updateCompanyBannerAction(company.id, url);
      if ("error" in result) throw new Error(result.error);
      setBannerUrl(url);
      toast.success("Banner actualizado.");
    } catch (err) {
      toast.error("No pudimos subir el banner", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleRemoveBanner() {
    const result = await updateCompanyBannerAction(company.id, null);
    if ("error" in result) {
      toast.error("No pudimos quitar el banner", { description: result.error });
      return;
    }
    setBannerUrl(null);
    toast.success("Banner eliminado.");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={64} height={64} className="size-full object-cover" />
          ) : (
            <Store className="size-6 text-muted-foreground" />
          )}
        </div>
        <div>
          <Label htmlFor="logo" className="cursor-pointer text-sm font-medium text-brand">
            {uploadingLogo ? "Subiendo..." : "Cambiar logo"}
          </Label>
          <input
            id="logo"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={!canEdit || uploadingLogo}
            onChange={handleLogoChange}
          />
          <p className="text-xs text-muted-foreground">PNG o JPG, ideal 512x512px.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Banner de tu catálogo (opcional)</Label>
        <div className="relative flex aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted">
          {bannerUrl ? (
            <Image src={bannerUrl} alt="" fill className="object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Sin banner — se ve más profesional con uno</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="banner" className="cursor-pointer text-sm font-medium text-brand">
            {uploadingBanner ? "Subiendo..." : bannerUrl ? "Cambiar banner" : "Subir banner"}
          </Label>
          <input
            id="banner"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={!canEdit || uploadingBanner}
            onChange={handleBannerChange}
          />
          {bannerUrl && canEdit && (
            <button
              type="button"
              onClick={handleRemoveBanner}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Quitar
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Ideal 1200x400px. Se muestra en la portada de tu catálogo.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accentColor">Color de tu catálogo</Label>
        <div className="flex items-center gap-3">
          <input
            id="accentColor"
            type="color"
            value={accentColor}
            disabled={!canEdit}
            onChange={handleAccentColorChange}
            className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
          />
          <span className="text-sm text-foreground">{accentColor}</span>
          {savingColor && <span className="text-xs text-muted-foreground">Guardando...</span>}
          {canEdit && hasCustomColor && (
            <button
              type="button"
              onClick={handleResetAccentColor}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Restablecer
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Se aplica solo a los botones y categorías de tu catálogo público — el panel de administración se mantiene igual.
        </p>
      </div>

      {toggleableFeatures.length > 0 && (
        <FeatureTogglesSection
          companyId={company.id}
          canEdit={canEdit}
          features={toggleableFeatures}
          initialValues={featureToggles}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre del negocio</Label>
          <Input
            id="name"
            value={values.name}
            disabled={!canEdit}
            onChange={(e) => patch("name", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de negocio</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
            <span>{businessModule.emoji}</span>
            <span>{businessModule.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Por ahora no se puede cambiar el tipo de negocio. Escríbenos si necesitas ayuda.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={values.phone}
            disabled={!canEdit}
            onChange={(e) => patch("phone", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsappNumber">WhatsApp (opcional)</Label>
          <Input
            id="whatsappNumber"
            value={values.whatsappNumber}
            disabled={!canEdit}
            onChange={(e) => patch("whatsappNumber", e.target.value)}
            placeholder="+57 300 123 4567"
          />
          <p className="text-xs text-muted-foreground">
            Se guarda para cuando esté disponible la notificación de pedidos por WhatsApp.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="companyEmail">Correo</Label>
          <Input
            id="companyEmail"
            type="email"
            value={values.email}
            disabled={!canEdit}
            onChange={(e) => patch("email", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">Ciudad</Label>
          <Input
            id="city"
            value={values.city}
            disabled={!canEdit}
            onChange={(e) => patch("city", e.target.value)}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={values.address}
            disabled={!canEdit}
            onChange={(e) => patch("address", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessHours">Horario (opcional)</Label>
          <Input
            id="businessHours"
            value={values.businessHours}
            disabled={!canEdit}
            onChange={(e) => patch("businessHours", e.target.value)}
            placeholder="Lun-Sáb 8am-6pm"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Descripción pública (opcional)</Label>
          <Textarea
            id="description"
            rows={2}
            value={values.description}
            disabled={!canEdit}
            onChange={(e) => patch("description", e.target.value)}
            placeholder="Se muestra en tu catálogo público."
          />
        </div>
      </div>

      <StoreLink companyId={company.id} slug={company.slug} canEdit={canEdit} />

      {canEdit ? (
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Solo el dueño del negocio puede editar esta información.
        </p>
      )}
    </form>
  );
}

function StoreLink({ companyId, slug, canEdit }: { companyId: string; slug: string; canEdit: boolean }) {
  const [origin, setOrigin] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(slug);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    // window.location solo existe en el cliente; el servidor renderiza la
    // ruta relativa y esto la completa con el origen tras el montaje.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const path = `${origin}/store/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No pudimos copiar el enlace.");
    }
  }

  function startEditing() {
    setValue(slug);
    setEditing(true);
  }

  async function handleSaveSlug() {
    setSaving(true);
    const result = await updateCompanySlugAction(companyId, value);
    setSaving(false);
    if ("error" in result) {
      toast.error("No pudimos guardar el URL", { description: result.error });
      return;
    }
    setEditing(false);
    toast.success("URL de tu tienda actualizado. Los enlaces anteriores dejarán de funcionar.");
  }

  if (editing) {
    return (
      <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
        <Label htmlFor="storeSlug">URL de tu catálogo público</Label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">{origin}/store/</span>
          <Input
            id="storeSlug"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase())}
            autoFocus
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Solo minúsculas, números y guiones. Si compartiste el enlace anterior, dejará de funcionar.
        </p>
        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" onClick={handleSaveSlug} disabled={saving}>
            {saving ? "Guardando..." : "Guardar URL"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Tu catálogo público</p>
        <p className="truncate text-sm text-foreground">{path}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={startEditing}>
            Editar URL
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Copy /> Copiar enlace
        </Button>
      </div>
    </div>
  );
}

function FeatureTogglesSection({
  companyId,
  canEdit,
  features,
  initialValues,
}: {
  companyId: string;
  canEdit: boolean;
  features: { feature: string; name: string; hint: string; defaultEnabled: boolean }[];
  initialValues: Record<string, boolean>;
}) {
  const [values, setValues] = React.useState(() =>
    Object.fromEntries(features.map((f) => [f.feature, initialValues[f.feature] ?? f.defaultEnabled])),
  );
  const [savingFeature, setSavingFeature] = React.useState<string | null>(null);

  async function handleToggle(feature: string, enabled: boolean) {
    setValues((v) => ({ ...v, [feature]: enabled }));
    setSavingFeature(feature);
    const result = await updateFeatureToggleAction(companyId, feature, enabled);
    setSavingFeature(null);
    if ("error" in result) {
      toast.error("No pudimos guardar el cambio", { description: result.error });
      setValues((v) => ({ ...v, [feature]: !enabled }));
      return;
    }
    toast.success(`${enabled ? "Activaste" : "Desactivaste"} ${features.find((f) => f.feature === feature)?.name}.`);
  }

  return (
    <div className="space-y-2">
      <Label>Módulos de tu negocio</Label>
      {features.map((f) => (
        <div key={f.feature} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="pr-3">
            <p className="text-sm font-medium text-foreground">{f.name}</p>
            <p className="text-xs text-muted-foreground">{f.hint}</p>
          </div>
          <Switch
            checked={values[f.feature]}
            disabled={!canEdit || savingFeature === f.feature}
            onCheckedChange={(checked) => handleToggle(f.feature, checked)}
          />
        </div>
      ))}
    </div>
  );
}
