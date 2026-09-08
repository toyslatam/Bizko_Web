-- =============================================================================
-- FASE — Productos/Servicios opcionales según el rubro
--
-- No todos los negocios venden productos Y servicios. Antes "Productos" y
-- "Servicios" solo dependían del plan (todos los negocios del mismo plan
-- veían lo mismo, sin importar el rubro). Ahora el rubro define un default
-- (fijo si no aplica en absoluto, o encendido/apagado si es opcional), y esta
-- tabla deja que el dueño prenda/apague las opcionales — ej. un salón de
-- uñas arranca sin "Productos" pero lo puede activar si vende esmaltes.
--
-- La lógica de qué feature es fija vs. opcional por rubro vive en código
-- (src/lib/features.ts), no aquí — es una regla de producto, no de
-- integridad de datos, y así es más fácil de ajustar sin migraciones nuevas.
-- =============================================================================
create table company_feature_toggles (
  company_id uuid not null references companies (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, feature_key)
);

alter table company_feature_toggles enable row level security;
create policy "company_feature_toggles_select_own_company" on company_feature_toggles for select
  using (is_company_member(company_id));
create policy "company_feature_toggles_owner_manage" on company_feature_toggles for all
  using (is_company_owner(company_id))
  with check (is_company_owner(company_id));
