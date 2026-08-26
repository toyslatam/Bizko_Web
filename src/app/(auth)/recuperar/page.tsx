"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function RecoverPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/actualizar-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error("No pudimos enviar el correo", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
          Revisa tu correo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te enviamos un enlace a <span className="font-medium">{email}</span> para
          que puedas crear una nueva contraseña.
        </p>
        <Link href="/login" className="mt-6 text-sm font-medium text-brand hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Recupera tu contraseña
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Te enviaremos un enlace para crear una nueva.
      </p>

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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}
