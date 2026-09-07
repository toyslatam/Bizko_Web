-- =============================================================================
-- FASE — Peluquerías, barberías y salones de belleza (expande la Agenda
-- básica de la Fase 9, no la reemplaza)
--
-- Reutiliza sin duplicar: customers, services/service_categories, sales,
-- cash_movements, appointments/appointment_status ya existentes. Solo agrega
-- lo exclusivo del vertical: profesionales, asignación servicio↔profesional,
-- comisiones, y las funciones que faltaban en Agenda (evitar doble reserva,
-- calcular hora de fin según duración, reservar desde el catálogo público,
-- y generar la venta cuando una cita se completa y se paga — mismo patrón
-- de trazabilidad CITA → VENTA que ya existe para PEDIDO → VENTA).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. appointment_status: agrega 'in_progress' ("En atención", §2) — ningún
-- function la referencia en su firma (solo la columna appointments.status),
-- así que no hace falta CASCADE.
-- ---------------------------------------------------------------------------
alter type appointment_status rename to appointment_status_old;
create type appointment_status as enum ('pending', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show');
alter table appointments alter column status drop default;
alter table appointments alter column status type appointment_status using status::text::appointment_status;
alter table appointments alter column status set default 'pending';
drop type appointment_status_old;

-- ---------------------------------------------------------------------------
-- 1. Profesionales (§5) — entidad propia, no depende de tener usuario/login
-- en bizko (un salón puede tener estilistas que no inician sesión).
-- ---------------------------------------------------------------------------
create table professionals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  photo_url text,
  specialty text,
  -- Horario semanal fijo simple (§5 "horario de trabajo, días disponibles") —
  -- domingo=0..sábado=6, suficiente para esta fase; excepciones puntuales
  -- (vacaciones, un día distinto) quedan para una fase futura.
  work_days smallint[] not null default '{1,2,3,4,5,6}',
  work_start_time time not null default '09:00',
  work_end_time time not null default '18:00',
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index professionals_company_id_idx on professionals (company_id, status);

alter table professionals enable row level security;
create policy "professionals_all_own_company" on professionals for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- Qué servicios puede realizar cada profesional (§4 "profesional que puede
-- realizarlo", §5 "servicios que realiza").
create table service_professionals (
  service_id uuid not null references services (id) on delete cascade,
  professional_id uuid not null references professionals (id) on delete cascade,
  primary key (service_id, professional_id)
);

alter table service_professionals enable row level security;
create policy "service_professionals_all_own_company" on service_professionals for all
  using (exists (select 1 from services s where s.id = service_id and is_company_member(s.company_id)))
  with check (
    exists (select 1 from services s where s.id = service_id and is_company_member(s.company_id))
    and exists (
      select 1 from services s join professionals p on p.company_id = s.company_id
      where s.id = service_id and p.id = professional_id
    )
  );

create function list_professionals_for_service(p_service_id uuid)
returns setof professionals
language sql
security invoker
stable
set search_path = public
as $$
  select p.* from professionals p
  join service_professionals sp on sp.professional_id = p.id
  where sp.service_id = p_service_id and p.status = 'active'
  order by p.name;
$$;
grant execute on function list_professionals_for_service to authenticated;

-- ---------------------------------------------------------------------------
-- 2. appointments: se agrega professional_id (reemplaza en la práctica a
-- employee_id para este vertical, sin borrarlo — sigue existiendo por si algo
-- más lo usa) y ready_for_sale para saber si ya generó su venta.
-- ---------------------------------------------------------------------------
alter table appointments add column if not exists professional_id uuid references professionals (id) on delete set null;
alter table appointments add column if not exists sale_id uuid references sales (id) on delete set null;
create index appointments_professional_id_idx on appointments (professional_id, appointment_date);

-- Evita reservar al mismo profesional dos veces en el mismo rango de horario
-- (§2 "evitar doble reserva") — se llama SIEMPRE al crear/mover una cita,
-- nunca se inserta/actualiza appointments directo desde el frontend.
create function check_professional_availability(
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
  );
$$;
grant execute on function check_professional_availability to authenticated;

-- Crea una cita calculando la hora de fin según la duración del servicio
-- (§2 "duración") si no se da una explícita, y rechaza el horario si el
-- profesional ya tiene algo en ese rango.
create function create_appointment_v2(
  p_company_id uuid,
  p_customer_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_notes text default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service services;
  v_end_time time;
  v_row appointments;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select * into v_service from services where id = p_service_id and company_id = p_company_id;
  v_end_time := p_start_time + make_interval(mins => coalesce(v_service.duration_minutes, 30));

  if p_professional_id is not null then
    if not check_professional_availability(p_professional_id, p_appointment_date, p_start_time, v_end_time) then
      raise exception 'Ese profesional ya tiene una cita en ese horario.';
    end if;
  end if;

  insert into appointments (
    company_id, customer_id, service_id, professional_id,
    appointment_date, start_time, end_time, status, notes
  ) values (
    p_company_id, p_customer_id, p_service_id, p_professional_id,
    p_appointment_date, p_start_time, v_end_time, 'pending', nullif(trim(p_notes), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function create_appointment_v2 to authenticated;

-- Mover/reprogramar una cita (§2 "editar, mover") — misma validación de
-- disponibilidad, excluyendo la propia cita del chequeo.
create function reschedule_appointment(
  p_appointment_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_professional_id uuid default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_service services;
  v_end_time time;
  v_professional_id uuid;
begin
  select * into v_appointment from appointments where id = p_appointment_id for update;
  if v_appointment.id is null or not is_company_member(v_appointment.company_id) then
    raise exception 'Cita no encontrada.';
  end if;

  v_professional_id := coalesce(p_professional_id, v_appointment.professional_id);
  select * into v_service from services where id = v_appointment.service_id;
  v_end_time := p_start_time + make_interval(mins => coalesce(v_service.duration_minutes, 30));

  if v_professional_id is not null then
    if not check_professional_availability(v_professional_id, p_appointment_date, p_start_time, v_end_time, p_appointment_id) then
      raise exception 'Ese profesional ya tiene una cita en ese horario.';
    end if;
  end if;

  update appointments set
    appointment_date = p_appointment_date,
    start_time = p_start_time,
    end_time = v_end_time,
    professional_id = v_professional_id,
    updated_at = now()
  where id = p_appointment_id
  returning * into v_appointment;

  return v_appointment;
end;
$$;
grant execute on function reschedule_appointment to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Comisiones (§8) — por profesional, opcionalmente específica a un
-- servicio (si no hay fila específica, aplica la de service_id = null como
-- comisión por defecto del profesional).
-- ---------------------------------------------------------------------------
create type commission_type as enum ('percentage', 'fixed');

create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  professional_id uuid not null references professionals (id) on delete cascade,
  service_id uuid references services (id) on delete cascade,
  commission_type commission_type not null default 'percentage',
  value numeric not null,
  unique (professional_id, service_id)
);
create index commission_rules_professional_idx on commission_rules (professional_id);

alter table commission_rules enable row level security;
create policy "commission_rules_all_own_company" on commission_rules for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create function calculate_commission_cents(p_professional_id uuid, p_service_id uuid, p_price_cents integer)
returns integer
language sql
security invoker
stable
set search_path = public
as $$
  select case rule.commission_type
    when 'fixed' then rule.value::integer
    else round(p_price_cents * rule.value / 100.0)::integer
  end
  from commission_rules rule
  where rule.professional_id = p_professional_id
    and (rule.service_id = p_service_id or rule.service_id is null)
  order by rule.service_id nulls last
  limit 1;
$$;
grant execute on function calculate_commission_cents to authenticated;

-- ---------------------------------------------------------------------------
-- 4. sale_source: agrega 'appointment' (§7, mismo patrón de trazabilidad
-- CITA → VENTA que PEDIDO → VENTA). report_sales_by_order_type() referencia
-- el tipo en su RETURNS TABLE (dependencia dura), así que se recrea junto
-- con el recreate del enum — mismo criterio ya usado con order_fulfillment.
-- ---------------------------------------------------------------------------
alter type sale_source rename to sale_source_old;
create type sale_source as enum ('pos', 'menu', 'delivery', 'table', 'takeout', 'appointment');
alter table sales alter column source drop default;
alter table sales alter column source type sale_source using source::text::sale_source;
alter table sales alter column source set default 'pos';
drop type sale_source_old cascade;

create function report_sales_by_order_type(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (source sale_source, total_cents bigint, sales_count integer)
language sql security invoker stable set search_path = public as $$
  select s.source, sum(s.total_cents)::bigint, count(*)::integer
  from sales s
  where s.company_id = p_company_id and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by s.source
  order by sum(s.total_cents) desc;
$$;
grant execute on function report_sales_by_order_type to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Completar y cobrar una cita (§7) — en una sola operación: marca la cita
-- completada+pagada, registra el movimiento de caja (mismo guard
-- v_already_has_movement de pedidos, nunca duplica) y genera la venta
-- asociando cliente, servicio y profesional. Puede incluir productos
-- vendidos junto con el servicio (§7 "una venta puede contener servicios +
-- productos") vía p_extra_items.
-- ---------------------------------------------------------------------------
create function complete_and_pay_appointment(
  p_appointment_id uuid,
  p_payment_method payment_method default 'cash',
  p_extra_items jsonb default '[]'::jsonb
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

  insert into sale_items (sale_id, service_id, item_type, name, quantity, unit_price_cents, discount_cents, total_cents)
  values (v_sale.id, v_appt.service_id, 'service', coalesce(v_service.name, 'Servicio'), 1,
    coalesce(v_service.price_cents, 0), 0, coalesce(v_service.price_cents, 0));

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
-- 6. Reserva desde el catálogo público (§6) — mismo principio de seguridad
-- que create_public_order(): valida todo server-side, nunca confía en el
-- navegador. Queda en estado 'pending' ("Solicitada") hasta que el negocio
-- la confirme desde Agenda.
-- ---------------------------------------------------------------------------
create function list_public_services(p_company_id uuid)
returns table (id uuid, category_id uuid, name text, description text, price_cents integer, duration_minutes integer, image_url text)
language sql
security definer
stable
set search_path = public
as $$
  select id, category_id, name, description, price_cents, duration_minutes, image_url
  from services
  where company_id = p_company_id and status = 'active' and is_published = true
  order by name;
$$;
grant execute on function list_public_services to anon, authenticated;

create function list_public_professionals(p_company_id uuid, p_service_id uuid default null)
returns table (id uuid, name text, photo_url text, specialty text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.name, p.photo_url, p.specialty
  from professionals p
  where p.company_id = p_company_id and p.status = 'active'
    and (
      p_service_id is null
      or exists (select 1 from service_professionals sp where sp.professional_id = p.id and sp.service_id = p_service_id)
    )
  order by p.name;
$$;
grant execute on function list_public_professionals to anon, authenticated;

-- Franjas libres de un profesional en una fecha, según su horario y sus
-- citas ya tomadas — en pasos de 30 minutos.
create function get_available_slots(p_professional_id uuid, p_appointment_date date, p_duration_minutes integer default 30)
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

create function create_public_appointment(
  p_company_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_customer_name text,
  p_customer_phone text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
  v_service services;
  v_end_time time;
  v_customer_id uuid;
  v_appointment_id uuid;
begin
  select * into v_company from companies where slug = p_company_slug;
  if v_company.id is null then
    raise exception 'Negocio no encontrado.';
  end if;

  select * into v_service from services
    where id = p_service_id and company_id = v_company.id and status = 'active' and is_published = true;
  if v_service.id is null then
    raise exception 'Ese servicio ya no está disponible.';
  end if;

  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if p_customer_phone is null or trim(p_customer_phone) = '' then
    raise exception 'El teléfono es obligatorio.';
  end if;

  v_end_time := p_start_time + make_interval(mins => coalesce(v_service.duration_minutes, 30));

  if p_professional_id is not null then
    if not exists (select 1 from professionals where id = p_professional_id and company_id = v_company.id) then
      raise exception 'Ese profesional ya no está disponible.';
    end if;
    if not check_professional_availability(p_professional_id, p_appointment_date, p_start_time, v_end_time) then
      raise exception 'Ese horario ya no está disponible — elige otro.';
    end if;
  end if;

  select id into v_customer_id from customers
    where company_id = v_company.id and phone = trim(p_customer_phone)
    limit 1;

  if v_customer_id is null then
    insert into customers (company_id, first_name, phone)
    values (v_company.id, trim(p_customer_name), trim(p_customer_phone))
    returning id into v_customer_id;
  end if;

  insert into appointments (
    company_id, customer_id, service_id, professional_id,
    appointment_date, start_time, end_time, status, notes
  ) values (
    v_company.id, v_customer_id, p_service_id, p_professional_id,
    p_appointment_date, p_start_time, v_end_time, 'pending', nullif(trim(p_notes), '')
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;
grant execute on function create_public_appointment to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Reportes de peluquería (§14) — mismo principio que los report_*()
-- existentes: security invoker, respeta RLS.
-- ---------------------------------------------------------------------------
create function report_appointments_by_professional(p_company_id uuid, p_start date, p_end date)
returns table (professional_id uuid, professional_name text, appointments_count integer, revenue_cents bigint, commission_cents bigint)
language sql security invoker stable set search_path = public as $$
  select p.id, p.name, count(a.id)::integer,
    coalesce(sum(s.price_cents), 0)::bigint,
    coalesce(sum(calculate_commission_cents(p.id, a.service_id, s.price_cents)), 0)::bigint
  from professionals p
  left join appointments a on a.professional_id = p.id and a.status = 'completed'
    and a.appointment_date >= p_start and a.appointment_date <= p_end
  left join services s on s.id = a.service_id
  where p.company_id = p_company_id and is_company_member(p_company_id)
  group by p.id, p.name
  order by count(a.id) desc;
$$;
grant execute on function report_appointments_by_professional to authenticated;

create function report_appointment_funnel(p_company_id uuid, p_start date, p_end date)
returns table (pending integer, confirmed integer, completed integer, canceled integer, no_show integer)
language sql security invoker stable set search_path = public as $$
  select
    count(*) filter (where status = 'pending')::integer,
    count(*) filter (where status = 'confirmed')::integer,
    count(*) filter (where status = 'completed')::integer,
    count(*) filter (where status = 'canceled')::integer,
    count(*) filter (where status = 'no_show')::integer
  from appointments
  where company_id = p_company_id and appointment_date >= p_start and appointment_date <= p_end
    and is_company_member(p_company_id);
$$;
grant execute on function report_appointment_funnel to authenticated;
