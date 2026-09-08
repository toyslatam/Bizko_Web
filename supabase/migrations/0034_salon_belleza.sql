-- =============================================================================
-- FASE — Salones de uñas/belleza: paquetes, historial, galería, bloqueos
--
-- Agenda + Profesionales + Comisiones + reserva pública + Caja/Venta desde
-- cita (0031_peluqueria.sql) ya cubren la mayoría de esta fase — aplican
-- igual a un salón de uñas, es el mismo business_type "barbershop". Esto
-- solo agrega lo que faltaba de verdad, reutilizando todo lo existente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Paquetes de servicios (§7) — un servicio "paquete" agrupa otros
-- servicios a un precio combinado. Mismo patrón que combo_items (productos,
-- Fase Restaurantes), pero para services. El paquete se agenda como UN solo
-- servicio (una sola cita, un solo profesional) — al completarse y cobrarse,
-- se desglosa en los servicios reales para que los reportes por servicio no
-- se pierdan (ver sección 3).
-- ---------------------------------------------------------------------------
alter table services add column if not exists is_package boolean not null default false;

create table service_package_items (
  id uuid primary key default gen_random_uuid(),
  package_service_id uuid not null references services (id) on delete cascade,
  component_service_id uuid not null references services (id) on delete cascade,
  quantity numeric not null default 1,
  sort_order integer not null default 0
);
create index service_package_items_package_id_idx on service_package_items (package_service_id);

alter table service_package_items enable row level security;
create policy "service_package_items_all_own_company" on service_package_items for all
  using (exists (select 1 from services s where s.id = package_service_id and is_company_member(s.company_id)))
  with check (
    exists (select 1 from services s where s.id = package_service_id and is_company_member(s.company_id))
    and exists (
      select 1 from services pkg, services comp
      where pkg.id = package_service_id and comp.id = component_service_id
        and pkg.company_id = comp.company_id
    )
  );

create function list_public_package_items(p_service_id uuid)
returns table (component_name text, quantity numeric)
language sql
security definer
stable
set search_path = public
as $$
  select cs.name, spi.quantity
  from service_package_items spi
  join services cs on cs.id = spi.component_service_id
  join services p on p.id = spi.package_service_id
  where spi.package_service_id = p_service_id and p.status = 'active' and p.is_published = true
  order by spi.sort_order;
$$;
grant execute on function list_public_package_items to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bloqueos/descansos/vacaciones por profesional (§5) — rangos de tiempo
-- en los que un profesional NO está disponible, más allá de su horario
-- semanal fijo (professionals.work_days/work_start_time/work_end_time).
-- ---------------------------------------------------------------------------
create table professional_time_off (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);
create index professional_time_off_professional_idx on professional_time_off (professional_id, starts_at);

alter table professional_time_off enable row level security;
create policy "professional_time_off_all_own_company" on professional_time_off for all
  using (exists (select 1 from professionals p where p.id = professional_id and is_company_member(p.company_id)))
  with check (exists (select 1 from professionals p where p.id = professional_id and is_company_member(p.company_id)));

-- Recrea check_professional_availability()/get_available_slots() de
-- 0031_peluqueria.sql agregando el chequeo contra los bloqueos.
create or replace function check_professional_availability(
  p_professional_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_appointment_id uuid default null
)
returns boolean
language sql
security invoker
stable
set search_path = public
as $$
  select not exists (
    select 1 from appointments a
    where a.professional_id = p_professional_id
      and a.appointment_date = p_appointment_date
      and a.status not in ('canceled', 'no_show')
      and (p_exclude_appointment_id is null or a.id != p_exclude_appointment_id)
      and a.start_time < p_end_time
      and coalesce(a.end_time, a.start_time + interval '30 minutes') > p_start_time
  )
  and not exists (
    select 1 from professional_time_off t
    where t.professional_id = p_professional_id
      and t.starts_at < (p_appointment_date + p_end_time)
      and t.ends_at > (p_appointment_date + p_start_time)
  );
$$;
grant execute on function check_professional_availability to authenticated;

create or replace function get_available_slots(p_professional_id uuid, p_appointment_date date, p_duration_minutes integer default 30)
returns table (slot_start time)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_prof professionals;
  v_dow integer;
  v_slot time;
begin
  select * into v_prof from professionals where id = p_professional_id;
  if v_prof.id is null then return; end if;

  v_dow := extract(dow from p_appointment_date);
  if not (v_dow = any(v_prof.work_days)) then return; end if;

  v_slot := v_prof.work_start_time;
  while v_slot + make_interval(mins => p_duration_minutes) <= v_prof.work_end_time loop
    if check_professional_availability(p_professional_id, p_appointment_date, v_slot, v_slot + make_interval(mins => p_duration_minutes)) then
      slot_start := v_slot;
      return next;
    end if;
    v_slot := v_slot + interval '30 minutes';
  end loop;
end;
$$;
grant execute on function get_available_slots to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. complete_and_pay_appointment(): agrega notas del profesional para el
-- historial de belleza (§4 — se guardan en sale_items.notes, ya existente
-- desde la Fase Restaurantes, así queda asociado al cliente vía la venta sin
-- tablas nuevas) y desglosa paquetes en sus servicios reales al cobrar (§7)
-- para no perder el detalle en reportes por servicio, ajustando con un
-- descuento la diferencia entre la suma de partes y el precio del paquete.
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE no alcanza aquí: agregar p_service_notes cambia la
-- aridad de la función, así que Postgres crearía una segunda función
-- sobrecargada en vez de reemplazar la original de 3 parámetros, dejando
-- el nombre ambiguo. Hay que tumbar esa firma vieja primero.
drop function if exists complete_and_pay_appointment(uuid, payment_method, jsonb);

create or replace function complete_and_pay_appointment(
  p_appointment_id uuid,
  p_payment_method payment_method default 'cash',
  p_extra_items jsonb default '[]'::jsonb,
  p_service_notes text default null
)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt appointments;
  v_service services;
  v_open_register_id uuid;
  v_seq integer;
  v_sale sales;
  v_item jsonb;
  v_product products;
  v_qty numeric;
  v_components_total integer := 0;
  v_component record;
begin
  select * into v_appt from appointments where id = p_appointment_id for update;
  if v_appt.id is null or not is_company_member(v_appt.company_id) then
    raise exception 'Cita no encontrada.';
  end if;
  if v_appt.sale_id is not null then
    select * into v_sale from sales where id = v_appt.sale_id;
    return v_sale;
  end if;

  select * into v_service from services where id = v_appt.service_id;

  update appointments set status = 'completed', updated_at = now() where id = p_appointment_id;

  select id into v_open_register_id from cash_registers
    where company_id = v_appt.company_id and status = 'open';

  update companies set sales_sequence = sales_sequence + 1
    where id = v_appt.company_id
    returning sales_sequence into v_seq;

  insert into sales (
    company_id, customer_id, user_id, sale_number,
    subtotal_cents, discount_cents, tax_cents, total_cents,
    payment_method, status, notes, source
  ) values (
    v_appt.company_id, v_appt.customer_id, auth.uid(), 'V-' || lpad(v_seq::text, 6, '0'),
    coalesce(v_service.price_cents, 0), 0, 0, coalesce(v_service.price_cents, 0),
    p_payment_method, 'completed', 'Cita del ' || v_appt.appointment_date, 'appointment'
  )
  returning * into v_sale;

  if v_service.is_package then
    for v_component in
      select cs.id, cs.name, cs.price_cents, spi.quantity
      from service_package_items spi
      join services cs on cs.id = spi.component_service_id
      where spi.package_service_id = v_service.id
      order by spi.sort_order
    loop
      insert into sale_items (sale_id, service_id, item_type, name, quantity, unit_price_cents, discount_cents, total_cents, notes)
      values (
        v_sale.id, v_component.id, 'service', v_component.name, v_component.quantity,
        v_component.price_cents, 0, round(v_component.price_cents * v_component.quantity)::integer,
        nullif(trim(p_service_notes), '')
      );
      v_components_total := v_components_total + round(v_component.price_cents * v_component.quantity)::integer;
    end loop;

    -- El paquete se cobra a su propio precio, no a la suma de las partes —
    -- se registra la diferencia como descuento para que el total cuadre.
    update sales set
      subtotal_cents = v_components_total,
      discount_cents = greatest(v_components_total - coalesce(v_service.price_cents, 0), 0),
      total_cents = coalesce(v_service.price_cents, 0)
      where id = v_sale.id;
  else
    insert into sale_items (sale_id, service_id, item_type, name, quantity, unit_price_cents, discount_cents, total_cents, notes)
    values (v_sale.id, v_appt.service_id, 'service', coalesce(v_service.name, 'Servicio'), 1,
      coalesce(v_service.price_cents, 0), 0, coalesce(v_service.price_cents, 0), nullif(trim(p_service_notes), ''));
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_extra_items, '[]'::jsonb)) loop
    select * into v_product from products
      where id = nullif(v_item ->> 'product_id', '')::uuid and company_id = v_appt.company_id
      for update;
    if v_product.id is null then continue; end if;
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 1);

    insert into sale_items (sale_id, product_id, item_type, name, quantity, unit_price_cents, discount_cents, total_cents)
    values (v_sale.id, v_product.id, 'product', v_product.name, v_qty, v_product.price_cents, 0,
      round(v_product.price_cents * v_qty)::integer);

    update sales set total_cents = total_cents + round(v_product.price_cents * v_qty)::integer,
      subtotal_cents = subtotal_cents + round(v_product.price_cents * v_qty)::integer
      where id = v_sale.id;

    if v_product.track_inventory then
      perform apply_inventory_movement(
        v_appt.company_id, v_product.id, 'out', v_qty,
        'Venta ' || v_sale.sale_number, 'sale', v_sale.id
      );
    end if;
  end loop;

  select * into v_sale from sales where id = v_sale.id;

  if v_open_register_id is not null then
    perform create_cash_movement(
      v_appt.company_id, v_open_register_id, 'income', v_sale.total_cents, p_payment_method,
      'sale', v_sale.id, 'Cita ' || v_appt.appointment_date
    );
  end if;

  update appointments set sale_id = v_sale.id, updated_at = now() where id = p_appointment_id;

  return v_sale;
end;
$$;
grant execute on function complete_and_pay_appointment to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Galería de trabajos (§12) — fotos de trabajos realizados, opcionalmente
-- asociadas a servicio/profesional/cliente. Preparada para reusarse después
-- en catálogo público y marketing (is_public controla eso).
-- ---------------------------------------------------------------------------
create table work_gallery (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  image_url text not null,
  service_id uuid references services (id) on delete set null,
  professional_id uuid references professionals (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index work_gallery_company_id_idx on work_gallery (company_id, created_at desc);

alter table work_gallery enable row level security;
create policy "work_gallery_all_own_company" on work_gallery for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create function list_public_gallery(p_company_id uuid, p_limit integer default 24)
returns table (id uuid, image_url text, description text, service_name text)
language sql
security definer
stable
set search_path = public
as $$
  select g.id, g.image_url, g.description, s.name
  from work_gallery g
  left join services s on s.id = g.service_id
  where g.company_id = p_company_id and g.is_public = true
  order by g.created_at desc
  limit p_limit;
$$;
grant execute on function list_public_gallery to anon, authenticated;
