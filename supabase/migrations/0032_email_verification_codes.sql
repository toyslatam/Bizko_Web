-- =============================================================================
-- FASE — Códigos de verificación propios (invitación / recuperar contraseña)
--
-- Reemplaza la dependencia del sistema de invitación/OTP nativo de Supabase
-- (link mágico de un solo uso, vulnerable a que Gmail/Outlook "visiten" el
-- link por escaneo de seguridad antes de que la persona le dé clic, y con
-- fallas de verificación no diagnosticables sin acceso al dashboard) por un
-- código de 6 dígitos generado y controlado 100% por bizko: se guarda
-- hasheado con expiración corta, se envía por Resend directo (no por el
-- mailer de Supabase Auth), y al confirmarlo se usa el service role para
-- poner la contraseña directo (auth.admin.updateUserById), sin pasarle nunca
-- el código a Supabase Auth. Solo el backend de bizko (service role) toca
-- esta tabla — sin políticas RLS para authenticated/anon, deny-all por
-- defecto.
-- =============================================================================
create table email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  code_hash text not null,
  purpose text not null check (purpose in ('invite', 'recovery')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_verification_codes_email_idx on email_verification_codes (email, purpose, created_at desc);

alter table email_verification_codes enable row level security;
-- Sin políticas: nadie con anon/authenticated puede leer ni escribir aquí,
-- solo el service role (que ya se salta RLS) desde las Server Actions.
