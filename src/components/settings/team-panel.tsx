"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, MEMBER_STATUS_LABELS } from "@/lib/permissions";
import { sendTeamInvitationAction } from "@/app/(app)/configuracion/actions";
import type { CompanyMember, CompanyRole, Profile } from "@/types/database";

type Member = CompanyMember & { profile: Profile };

const STATUS_VARIANT: Record<Member["status"], "default" | "secondary" | "outline"> = {
  active: "default",
  invited: "secondary",
  inactive: "outline",
};

export function TeamPanel({
  companyId,
  members,
  currentUserId,
  canManage,
}: {
  companyId: string;
  members: Member[];
  currentUserId: string;
  canManage: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "persona" : "personas"} con acceso
        </p>
        {canManage && <InviteDialog companyId={companyId} />}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-foreground">
                  {memberName(m)} {m.user_id === currentUserId && "(tú)"}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.profile.email}</TableCell>
                <TableCell>{ROLE_LABELS[m.role]}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[m.status]}>
                    {MEMBER_STATUS_LABELS[m.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {members.map((m) => (
          <MobileListItem
            key={m.id}
            title={`${memberName(m)}${m.user_id === currentUserId ? " (tú)" : ""}`}
            subtitle={m.profile.email}
            leading={
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand/15 text-xs font-semibold text-brand">
                  {memberName(m).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            }
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</span>
                <Badge variant={STATUS_VARIANT[m.status]} className="text-[10px]">
                  {MEMBER_STATUS_LABELS[m.status]}
                </Badge>
              </div>
            }
          />
        ))}
      </MobileList>
    </div>
  );
}

function memberName(m: Member) {
  const name = [m.profile.first_name, m.profile.last_name].filter(Boolean).join(" ");
  return name || m.profile.email.split("@")[0];
}

function InviteDialog({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<CompanyRole>("employee");
  const [sending, setSending] = React.useState(false);

  async function handleInvite() {
    setSending(true);
    const result = await sendTeamInvitationAction(companyId, email, role);
    setSending(false);

    if ("error" in result) {
      toast.error("No pudimos enviar la invitación", { description: result.error });
      return;
    }
    toast.success(
      result.alreadyHadAccount
        ? "Esa persona ya tenía cuenta en bizko — se agregó directo a tu equipo."
        : "Invitación enviada. Le llegó un correo para crear su contraseña.",
    );
    setOpen(false);
    setEmail("");
    setRole("employee");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> Invitar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar a tu equipo</DialogTitle>
          <DialogDescription>
            Le enviaremos un correo de invitación para que se una a tu negocio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inviteEmail">Correo electrónico</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="empleado@negocio.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="employee">Empleado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            Si ese correo ya tiene cuenta en bizko, se agrega directo. Si es nuevo,
            le llega un correo para crear su contraseña.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleInvite} disabled={sending || !email}>
            {sending ? "Enviando..." : "Enviar invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
