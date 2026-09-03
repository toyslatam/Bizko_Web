"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/error-messages";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const expired = searchParams.get("expired") === "1";
  const linkExpired = searchParams.get("linkExpired") === "1";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error("No pudimos iniciar sesión", { description: authErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Bienvenido de nuevo
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ingresa a tu negocio en bizko.
      </p>

      {expired && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2.5 text-sm text-warning-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          Tu sesión expiró. Inicia sesión nuevamente para continuar.
        </div>
      )}
      {linkExpired && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2.5 text-sm text-warning-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          Ese enlace ya expiró. Pide que te reenvíen la invitación o el correo de
          recuperación, e intenta de nuevo con el nuevo enlace.
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@negocio.com"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link href="/recuperar" className="text-xs font-medium text-brand hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand hover:underline">
          Crea tu negocio gratis
        </Link>
      </p>
    </>
  );
}
