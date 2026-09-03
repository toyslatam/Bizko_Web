"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    let resolved = false;

    // El token de invitación/recuperación viene en el hash de la URL — el
    // cliente de Supabase lo procesa de forma asíncrona al montar. Un solo
    // getSession() inmediato puede ganarle esa carrera y reportar "sin
    // sesión" antes de que el token termine de procesarse, así que también
    // se escucha el evento que dispara justo cuando la sesión queda lista.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !resolved) {
        resolved = true;
        setHasSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (resolved) return;
      if (data.session) {
        resolved = true;
        setHasSession(true);
        setChecking(false);
        return;
      }
      // Sin sesión todavía — puede ser que el hash aún se esté procesando.
      // Se da un margen antes de declarar el enlace inválido.
      window.setTimeout(() => {
        if (!resolved) setChecking(false);
      }, 1500);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      router.push("/dashboard");
    } catch (err) {
      toast.error("No pudimos actualizar tu contraseña", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <LoadingState rows={2} />;

  if (!hasSession) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
          Enlace inválido o expirado
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicita un nuevo enlace para restablecer tu contraseña.
        </p>
        <Link href="/recuperar" className="mt-6 text-sm font-medium text-brand hover:underline">
          Solicitar de nuevo
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Crea una nueva contraseña
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elige una contraseña segura para tu cuenta.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="password">Nueva contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Guardando..." : "Guardar contraseña"}
        </Button>
      </form>
    </>
  );
}
