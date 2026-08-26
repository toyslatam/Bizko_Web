-- =============================================================================
-- FASE 14 — Producción, seguridad, infraestructura y escalabilidad
-- Endurecimiento concreto encontrado en la auditoría de esta fase. Ver
-- docs/fase-14-produccion-checklist.md para el resto (VPS, n8n, monitoreo,
-- backups, CI/CD, dominios) — esas partes no tienen nada que migrar todavía
-- porque dependen de infraestructura que aún no existe.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Índices que faltaban en columnas usadas por los reportes/dashboards más
-- pesados (Fase 14 §25/§26) — encontrados al auditar los filtros reales de
-- cada report_*()/get_public_*().
-- ---------------------------------------------------------------------------
create index if not exists sales_company_created_idx on sales (company_id, created_at desc);
create index if not exists order_items_order_id_idx on order_items (order_id);
create index if not exists expenses_company_spent_at_idx on expenses (company_id, spent_at desc);

-- ---------------------------------------------------------------------------
-- 2. Idempotencia (Fase 14 §10) — clave opcional para que un reintento de
-- red o un webhook duplicado no cree un segundo registro financiero o una
-- segunda ejecución. Nada la usa activamente todavía (ningún flujo genera
-- una clave hoy); queda preparada para cuando el checkout/dispatch de
-- automatizaciones empiece a enviarla.
-- ---------------------------------------------------------------------------
alter table sales add column if not exists idempotency_key text;
create unique index if not exists sales_idempotency_key_idx
  on sales (company_id, idempotency_key) where idempotency_key is not null;

alter table cash_movements add column if not exists idempotency_key text;
create unique index if not exists cash_movements_idempotency_key_idx
  on cash_movements (company_id, idempotency_key) where idempotency_key is not null;

alter table automation_usage add column if not exists idempotency_key text;
create unique index if not exists automation_usage_idempotency_key_idx
  on automation_usage (automation_id, idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- 3. Auditoría de negocio (Fase 14 §39) — cambio de precio, anulación de
-- venta y cierre de caja no tenían un registro unificado y consultable (cada
-- uno queda parcialmente rastreado en su propia tabla de dominio, pero no en
-- un solo lugar). Distinto de admin_audit_logs (Fase 12), que es solo para
-- acciones del Super Admin sobre la plataforma — esta es visible para la
-- propia empresa.
-- ---------------------------------------------------------------------------
create table business_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index business_audit_logs_company_created_idx on business_audit_logs (company_id, created_at desc);

alter table business_audit_logs enable row level security;
create policy "business_audit_logs_select_own_company" on business_audit_logs for select
  using (is_company_member(company_id));
create policy "business_audit_logs_insert_own_company" on business_audit_logs for insert
  with check (is_company_member(company_id));
-- Sin update/delete: un registro de auditoría no se edita ni se borra.

-- void_sale(): mismo cuerpo que la Fase 8, con el registro de auditoría
-- agregado al final.
create or replace function void_sale(p_sale_id uuid)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales;
  v_item record;
  v_track_inventory boolean;
  v_is_owner_or_manager boolean;
  v_movement cash_movements;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Venta no encontrada.';
  end if;
  if v_sale.status != 'completed' then
    raise exception 'Solo se pueden anular ventas completadas.';
  end if;

  select exists (
    select 1 from company_members
    where company_id = v_sale.company_id and user_id = auth.uid()
      and role in ('owner', 'manager') and status = 'active'
  ) or is_platform_admin() into v_is_owner_or_manager;

  if not v_is_owner_or_manager then
    raise exception 'No tienes permiso para anular ventas.';
  end if;

  update sales set status = 'voided', updated_at = now()
    where id = p_sale_id
    returning * into v_sale;

  for v_item in
    select * from sale_items where sale_id = p_sale_id and item_type = 'product' and product_id is not null
  loop
    select track_inventory into v_track_inventory from products where id = v_item.product_id;
    if v_track_inventory then
      perform apply_inventory_movement(
        v_sale.company_id, v_item.product_id, 'return', v_item.quantity,
        'Anulación de venta ' || v_sale.sale_number, 'sale_void', v_sale.id
      );
    end if;
  end loop;

  select * into v_movement from cash_movements
    where reference_type = 'sale' and reference_id = p_sale_id and movement_type = 'income'
    limit 1;

  if v_movement.id is not null then
    if (select status from cash_registers where id = v_movement.cash_register_id) = 'open' then
      perform create_cash_movement(
        v_sale.company_id, v_movement.cash_register_id, 'expense', abs(v_movement.amount_cents),
        v_movement.payment_method, 'sale_void', v_sale.id, 'Anulación de venta ' || v_sale.sale_number
      );
    end if;
  end if;

  insert into business_audit_logs (company_id, user_id, action, target_type, target_id, metadata)
  values (v_sale.company_id, auth.uid(), 'SALE_VOIDED', 'sale', v_sale.id,
    jsonb_build_object('sale_number', v_sale.sale_number, 'total_cents', v_sale.total_cents));

  return v_sale;
end;
$$;

-- close_cash_register(): mismo cuerpo que la Fase 8, con el registro de
-- auditoría agregado al final.
create or replace function close_cash_register(
  p_cash_register_id uuid,
  p_counted_amount_cents integer,
  p_notes text
)
returns cash_registers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_register cash_registers;
  v_expected integer;
  v_difference integer;
begin
  select * into v_register from cash_registers where id = p_cash_register_id;
  if v_register.id is null then
    raise exception 'Caja no encontrada.';
  end if;
  if not is_company_member(v_register.company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  if v_register.status != 'open' then
    raise exception 'Esta caja ya está cerrada.';
  end if;

  select v_register.opening_amount_cents + coalesce(sum(amount_cents), 0)
    into v_expected
    from cash_movements
    where cash_register_id = p_cash_register_id and payment_method = 'cash';

  v_difference := coalesce(p_counted_amount_cents, 0) - v_expected;

  if v_difference != 0 then
    perform create_cash_movement(
      v_register.company_id, p_cash_register_id, 'adjustment', v_difference, 'cash',
      'cash_register_close', p_cash_register_id, 'Diferencia de cierre'
    );
  end if;

  update cash_registers set
    status = 'closed',
    closed_by = auth.uid(),
    closed_at = now(),
    counted_amount_cents = p_counted_amount_cents,
    expected_amount_cents = v_expected,
    difference_cents = v_difference,
    closing_notes = nullif(trim(p_notes), '')
  where id = p_cash_register_id
  returning * into v_register;

  insert into business_audit_logs (company_id, user_id, action, target_type, target_id, metadata)
  values (v_register.company_id, auth.uid(), 'CASH_REGISTER_CLOSED', 'cash_register', v_register.id,
    jsonb_build_object('expected_cents', v_expected, 'counted_cents', p_counted_amount_cents, 'difference_cents', v_difference));

  return v_register;
end;
$$;

grant execute on function close_cash_register to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage: límites de tamaño y tipo de archivo por bucket (Fase 14 §27/
-- §30) — antes no había ningún límite configurado a nivel de bucket, solo la
-- restricción de carpeta por empresa. 5 MB / imágenes para logos y fotos de
-- producto; 15 MB / imágenes y PDF para documentos.
-- ---------------------------------------------------------------------------
update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where id in ('logos', 'product-images');

update storage.buckets set
  file_size_limit = 15728640,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
where id = 'documents';
