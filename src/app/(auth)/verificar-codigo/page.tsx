"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

const VALID_TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email_change", "magiclink"];

export default function VerifyCodePage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyCodeForm />
    </React.Suspense>
  );
}

function VerifyCodeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as EmailOtpType | null;
  const type: EmailOtpType = typeParam && VALID_TYPES.includes(typeParam) ? typeParam : "recovery";

  const [email, setEmail] = React.useState(searchParams.get("email") ?? "");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type,
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      toast.success("Contraseña creada correctamente.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error("No pudimos verificar el código", {
        description:
          err instanceof Error
            ? err.message
            : "Revisa que el código sea correcto — se venció o ya se usó, pide uno nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Confirma tu código
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escribe el código de 6 dígitos que te enviamos por correo y elige tu contraseña.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="verifyEmail">Correo electrónico</Label>
          <Input
            id="verifyEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@negocio.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verifyCode">Código de 6 dígitos</Label>
          <Input
            id="verifyCode"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verifyPassword">Nueva contraseña</Label>
          <Input
            id="verifyPassword"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verificando..." : "Confirmar y continuar"}
        </Button>
      </form>
    </>
  );
}
