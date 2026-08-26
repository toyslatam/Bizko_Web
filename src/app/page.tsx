import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BUSINESS_MODULES } from "@/modules/registry";
import { createClient } from "@/lib/supabase/server";
import { formatPlanPrice } from "@/lib/plans";
import { CheckCircle2 } from "lucide-react";
import type { Plan, PlanCode } from "@/types/database";

interface PlanWithFeatures extends Plan {
  plan_features: { enabled: boolean; feature: { name: string } | null }[];
}

const PLAN_EMOJI: Record<PlanCode, string> = {
  basico: "",
  negocio: "⭐ ",
  pro: "🚀 ",
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: plansData } = await supabase
    .from("plans")
    .select("*, plan_features(enabled, feature:features(name))")
    .eq("is_active", true)
    .order("price_monthly_cents", { ascending: true });
  const plans = (plansData ?? []) as unknown as PlanWithFeatures[];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Image src="/files/app_icon.svg" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-heading text-lg font-semibold text-foreground">bizko</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/registro">Empieza gratis</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          Hecho para negocios pequeños
        </span>
        <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Tu negocio, inteligente
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Administra tus ventas, pedidos, inventario y clientes desde una sola
          app. Simple hoy, inteligente mañana con automatización e IA.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-11 px-6" asChild>
            <Link href="/registro">Empieza gratis</Link>
          </Button>
          <Button size="lg" variant="brand" className="h-11 px-6" asChild>
            <Link href="/login">Ver demo</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="text-center font-heading text-xl font-semibold text-foreground">
          Hecho para tu tipo de negocio
        </h2>
        <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted-foreground">
          Elige tu rubro al crear tu cuenta y bizko se adapta a ti.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {BUSINESS_MODULES.map((m) => (
            <div
              key={m.type}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-5 text-center"
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-xs font-medium text-foreground">{m.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="text-center font-heading text-xl font-semibold text-foreground">
          Un plan para cada etapa
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const price = formatPlanPrice(plan);
            return (
            <div
              key={plan.id}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              {plan.is_recommended && (
                <span className="mb-2 w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                  Recomendado
                </span>
              )}
              <h3 className="font-heading text-lg font-semibold text-foreground">
                {PLAN_EMOJI[plan.code]}
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-3 font-heading text-2xl font-semibold text-foreground">
                {price.primary}
                {plan.price_monthly_cents > 0 && (
                  <span className="text-sm font-normal text-muted-foreground"> / mes</span>
                )}
              </p>
              {price.secondary && (
                <p className="text-xs text-muted-foreground">{price.secondary}</p>
              )}
              <ul className="mt-4 flex-1 space-y-2">
                {plan.plan_features
                  .filter((pf) => pf.enabled && pf.feature)
                  .map((pf) => (
                    <li key={pf.feature!.name} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      {pf.feature!.name}
                    </li>
                  ))}
              </ul>
              <Button className="mt-6" variant={plan.is_recommended ? "default" : "outline"} asChild>
                <Link href="/registro">Elegir {plan.name}</Link>
              </Button>
            </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-auto border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} bizko — Tu negocio, inteligente.
      </footer>
    </div>
  );
}
