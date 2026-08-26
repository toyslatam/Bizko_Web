"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BUSINESS_MODULES } from "@/modules/registry";
import type { BusinessType } from "@/types/database";
import { createCompanyAction } from "@/app/onboarding/actions";

const STEPS = ["Tu negocio", "Tipo de negocio", "Configuración", "Listo"] as const;

interface OnboardingState {
  businessName: string;
  businessType: BusinessType | null;
  phone: string;
  email: string;
  city: string;
  address: string;
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [state, setState] = React.useState<OnboardingState>({
    businessName: "",
    businessType: null,
    phone: "",
    email: "",
    city: "",
    address: "",
  });

  const canAdvance =
    (step === 0 && state.businessName.trim().length > 1) ||
    (step === 1 && state.businessType !== null) ||
    step === 2 ||
    step === 3;

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function next() {
    if (step === 0 || step === 1) {
      setStep(step + 1);
      return;
    }

    if (step === 2) {
      if (!state.businessType) return;
      setCreating(true);
      const result = await createCompanyAction({
        name: state.businessName.trim(),
        businessType: state.businessType,
        phone: state.phone.trim(),
        email: state.email.trim(),
        address: state.address.trim(),
        city: state.city.trim(),
      });
      setCreating(false);

      if ("error" in result) {
        toast.error("No pudimos crear tu negocio", { description: result.error });
        return;
      }
      setStep(3);
    }
  }

  function finish() {
    toast.success("¡Tu negocio está listo!", {
      description: "Ya puedes empezar a usar bizko.",
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < step
                  ? "bg-brand text-white"
                  : i === step
                    ? "bg-brand/15 text-brand ring-2 ring-brand"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  i < step ? "bg-brand" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-80 rounded-2xl border border-border bg-card p-6 sm:p-8">
        {step === 0 && (
          <StepBusinessName
            value={state.businessName}
            onChange={(businessName) => setState((s) => ({ ...s, businessName }))}
          />
        )}
        {step === 1 && (
          <StepBusinessType
            value={state.businessType}
            onChange={(businessType) => setState((s) => ({ ...s, businessType }))}
          />
        )}
        {step === 2 && (
          <StepConfigure
            phone={state.phone}
            email={state.email}
            city={state.city}
            address={state.address}
            onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
          />
        )}
        {step === 3 && <StepDone state={state} />}
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0 || creating}>
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canAdvance || creating}>
            {creating ? "Creando tu negocio..." : "Continuar"}
          </Button>
        ) : (
          <Button onClick={finish}>Ir a mi dashboard</Button>
        )}
      </div>
    </div>
  );
}

function StepBusinessName({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        ¿Cómo se llama tu negocio?
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Este nombre aparecerá en tu catálogo y tus recibos.
      </p>
      <div className="mt-6 space-y-1.5">
        <Label htmlFor="businessName">Nombre del negocio</Label>
        <Input
          id="businessName"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Panadería El Trigal"
        />
      </div>
    </div>
  );
}

function StepBusinessType({
  value,
  onChange,
}: {
  value: BusinessType | null;
  onChange: (v: BusinessType) => void;
}) {
  return (
    <div>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        ¿A qué se dedica tu negocio?
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Así preparamos bizko para tu tipo de negocio.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BUSINESS_MODULES.map((m) => (
          <button
            key={m.type}
            type="button"
            onClick={() => onChange(m.type)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
              value === m.type
                ? "border-brand bg-brand/5 ring-1 ring-brand"
                : "border-border hover:bg-muted/60",
            )}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-xs font-medium text-foreground">{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepConfigure({
  phone,
  email,
  city,
  address,
  onChange,
}: {
  phone: string;
  email: string;
  city: string;
  address: string;
  onChange: (patch: Partial<Pick<OnboardingState, "phone" | "email" | "city" | "address">>) => void;
}) {
  return (
    <div>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Cuéntanos un poco más
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Puedes cambiar esto después en Configuración → Mi negocio.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono de contacto</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="300 123 4567"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onboardingEmail">Correo del negocio</Label>
          <Input
            id="onboardingEmail"
            type="email"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="contacto@negocio.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ciudad</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Bogotá"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Calle 10 # 20-30"
          />
        </div>
      </div>
    </div>
  );
}

function StepDone({ state }: { state: OnboardingState }) {
  const checklist = [
    { label: "Crear negocio", done: true },
    { label: "Agregar producto", done: false },
    { label: "Configurar información", done: Boolean(state.phone || state.address) },
    { label: "Publicar catálogo", done: false },
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <Image
        src="/files/app_icon.svg"
        alt=""
        width={56}
        height={56}
        className="rounded-2xl"
      />
      <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
        ¡{state.businessName || "Tu negocio"} está listo!
      </h1>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Completa estos pasos cuando quieras para sacarle el máximo provecho a
        bizko.
      </p>
      <ul className="mt-6 w-full max-w-xs space-y-2 text-left">
        {checklist.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                item.done ? "bg-success text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {item.done && <Check className="size-3" />}
            </span>
            <span className={cn(item.done ? "text-foreground" : "text-muted-foreground")}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
