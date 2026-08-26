-- =============================================================================
-- FASE — CRM (sobre el CORE existente de bizko)
--
-- No es una app aparte: leads y clientes conviven con `customers`/`sales`/
-- `orders` ya existentes. Un lead se GANA convirtiéndolo en un `customers`
-- real (nunca se duplica la tabla de clientes) — la trazabilidad
-- LEAD → CLIENTE → PEDIDO → VENTA queda en `customers.converted_from_lead_id`
-- + los pedidos/ventas que ya referencian ese customer_id.
--
-- Los canales (WhatsApp/Instagram/Facebook/LinkedIn/Email) NO se conectan en
-- esta fase (no hay API keys ni VPS todavía, igual que la Fase 13 de IA) —
-- solo se deja la estructura (`crm_channels`/`crm_conversations`) para que la
-- bandeja de entrada funcione con datos reales el día que se conecten. Ver
-- docs/fase-crm-marketing.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pipeline configurable por empresa (§1) — stages editables, con dos
-- marcadas como terminales (ganado/perdido) para que el reporte de conversión
-- sepa dónde termina el embudo sin adivinar por nombre.
-- ---------------------------------------------------------------------------
create table crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);
create index crm_pipeline_stages_company_id_idx on crm_pipeline_stages (company_id, sort_order);

alter table crm_pipeline_stages enable row level security;
create policy "crm_pipeline_stages_all_own_company" on crm_pipeline_stages for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- Devuelve el pipeline de la empresa, creando el default (§1) la primera vez
-- que se pide — evita tener que engancharse a cada lugar del código que crea
-- una empresa nueva (hay varios: onboarding, admin, seed de demo...).
create function get_or_create_default_pipeline(p_company_id uuid)
returns setof crm_pipeline_stages
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  if not exists (select 1 from crm_pipeline_stages where company_id = p_company_id) then
    insert into crm_pipeline_stages (company_id, name, sort_order, is_won, is_lost) values
      (p_company_id, 'Nuevo', 0, false, false),
      (p_company_id, 'Contactado', 1, false, false),
      (p_company_id, 'Interesado', 2, false, false),
      (p_company_id, 'Cotización', 3, false, false),
      (p_company_id, 'Negociación', 4, false, false),
      (p_company_id, 'Ganado', 5, true, false),
      (p_company_id, 'Perdido', 6, false, true);
  end if;

  return query select * from crm_pipeline_stages where company_id = p_company_id order by sort_order;
end;
$$;
grant execute on function get_or_create_default_pipeline to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Leads (§2) — trae su propio contacto (no reutiliza `customers` hasta que
-- se convierte, un lead todavía no es un cliente real).
-- ---------------------------------------------------------------------------
create type lead_source as enum (
  'whatsapp', 'instagram', 'facebook', 'linkedin', 'website', 'form', 'catalog', 'referral', 'manual'
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  stage_id uuid not null references crm_pipeline_stages (id) on delete restrict,
  name text not null,
  phone text,
  email text,
  company_name text,
  source lead_source not null default 'manual',
  product_interest text,
  potential_value_cents integer,
  assigned_to uuid references auth.users (id) on delete set null,
  -- Se llena solo al convertir (§3) — nunca se borra, es el rastro de que
  -- este lead ya es cliente.
  customer_id uuid references customers (id) on delete set null,
  next_action_at timestamptz,
  next_action_note text,
  last_interaction_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_company_id_idx on leads (company_id, stage_id);
create index leads_customer_id_idx on leads (customer_id);

alter table leads enable row level security;
create policy "leads_all_own_company" on leads for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- Historial de cambios de etapa (§3 "trazabilidad") — separado de leads para
-- no perder el recorrido cuando el lead se mueve varias veces.
create table lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  from_stage_id uuid references crm_pipeline_stages (id) on delete set null,
  to_stage_id uuid not null references crm_pipeline_stages (id) on delete cascade,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index lead_stage_history_lead_id_idx on lead_stage_history (lead_id, changed_at desc);

alter table lead_stage_history enable row level security;
create policy "lead_stage_history_select_own_company" on lead_stage_history for select
  using (exists (select 1 from leads l where l.id = lead_id and is_company_member(l.company_id)));

create function create_lead(
  p_company_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_company_name text,
  p_source lead_source,
  p_product_interest text,
  p_potential_value_cents integer,
  p_stage_id uuid default null
)
returns leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage_id uuid;
  v_row leads;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;

  v_stage_id := p_stage_id;
  if v_stage_id is null then
    select id into v_stage_id from crm_pipeline_stages
      where company_id = p_company_id order by sort_order limit 1;
  end if;
  if v_stage_id is null then
    perform get_or_create_default_pipeline(p_company_id);
    select id into v_stage_id from crm_pipeline_stages
      where company_id = p_company_id order by sort_order limit 1;
  end if;

  insert into leads (
    company_id, stage_id, name, phone, email, company_name, source,
    product_interest, potential_value_cents, created_by
  ) values (
    p_company_id, v_stage_id, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
    nullif(trim(p_company_name), ''), p_source, nullif(trim(p_product_interest), ''),
    p_potential_value_cents, auth.uid()
  )
  returning * into v_row;

  insert into lead_stage_history (lead_id, from_stage_id, to_stage_id, changed_by)
  values (v_row.id, null, v_stage_id, auth.uid());

  return v_row;
end;
$$;
grant execute on function create_lead to authenticated;

-- Mueve un lead de etapa y deja rastro en el historial (§3) en la misma
-- transacción — nunca se actualiza `leads.stage_id` directo desde el cliente.
create function move_lead_stage(p_lead_id uuid, p_stage_id uuid)
returns leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads;
  v_new_stage crm_pipeline_stages;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if v_lead.id is null or not is_company_member(v_lead.company_id) then
    raise exception 'Lead no encontrado.';
  end if;

  select * into v_new_stage from crm_pipeline_stages
    where id = p_stage_id and company_id = v_lead.company_id;
  if v_new_stage.id is null then
    raise exception 'Etapa no encontrada.';
  end if;

  update leads set stage_id = p_stage_id, last_interaction_at = now(), updated_at = now()
    where id = p_lead_id
    returning * into v_lead;

  insert into lead_stage_history (lead_id, from_stage_id, to_stage_id, changed_by)
  values (p_lead_id, v_lead.stage_id, p_stage_id, auth.uid());

  return v_lead;
end;
$$;
grant execute on function move_lead_stage to authenticated;

-- Convierte un lead en cliente real (§3) — LEAD → CLIENTE. Nunca duplica: si
-- el lead ya tiene customer_id, devuelve el existente. Deja al lead en la
-- primera etapa marcada is_won.
create function convert_lead_to_customer(p_lead_id uuid)
returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads;
  v_customer customers;
  v_won_stage_id uuid;
  v_first_last_split integer;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if v_lead.id is null or not is_company_member(v_lead.company_id) then
    raise exception 'Lead no encontrado.';
  end if;

  if v_lead.customer_id is not null then
    select * into v_customer from customers where id = v_lead.customer_id;
    return v_customer;
  end if;

  v_first_last_split := position(' ' in v_lead.name);

  insert into customers (company_id, first_name, last_name, phone, email, source, converted_from_lead_id)
  values (
    v_lead.company_id,
    case when v_first_last_split > 0 then substring(v_lead.name from 1 for v_first_last_split - 1) else v_lead.name end,
    case when v_first_last_split > 0 then substring(v_lead.name from v_first_last_split + 1) else null end,
    v_lead.phone, v_lead.email, v_lead.source, v_lead.id
  )
  returning * into v_customer;

  select id into v_won_stage_id from crm_pipeline_stages
    where company_id = v_lead.company_id and is_won = true order by sort_order limit 1;

  update leads set customer_id = v_customer.id, last_interaction_at = now(), updated_at = now(),
    stage_id = coalesce(v_won_stage_id, stage_id)
    where id = p_lead_id;

  if v_won_stage_id is not null and v_won_stage_id != v_lead.stage_id then
    insert into lead_stage_history (lead_id, from_stage_id, to_stage_id, changed_by)
    values (p_lead_id, v_lead.stage_id, v_won_stage_id, auth.uid());
  end if;

  return v_customer;
end;
$$;
grant execute on function convert_lead_to_customer to authenticated;

alter table customers add column if not exists source lead_source;
alter table customers add column if not exists converted_from_lead_id uuid references leads (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Tareas y notas (§1) — genéricas: cuelgan de un lead O de un cliente,
-- nunca de ambos (así la vista 360° del cliente y la del lead comparten el
-- mismo componente sin duplicar tablas).
-- ---------------------------------------------------------------------------
create table crm_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  customer_id uuid references customers (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  done_at timestamptz,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint crm_tasks_one_owner check (
    (lead_id is not null and customer_id is null) or (lead_id is null and customer_id is not null)
  )
);
create index crm_tasks_lead_id_idx on crm_tasks (lead_id);
create index crm_tasks_customer_id_idx on crm_tasks (customer_id);
create index crm_tasks_company_pending_idx on crm_tasks (company_id, due_at) where done_at is null;

alter table crm_tasks enable row level security;
create policy "crm_tasks_all_own_company" on crm_tasks for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create table crm_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  customer_id uuid references customers (id) on delete cascade,
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint crm_notes_one_owner check (
    (lead_id is not null and customer_id is null) or (lead_id is null and customer_id is not null)
  )
);
create index crm_notes_lead_id_idx on crm_notes (lead_id);
create index crm_notes_customer_id_idx on crm_notes (customer_id);

alter table crm_notes enable row level security;
create policy "crm_notes_all_own_company" on crm_notes for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- 4. Etiquetas (§1) — igual patrón polimórfico que tareas/notas.
-- ---------------------------------------------------------------------------
create table crm_tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  color text not null default '#6366F1',
  unique (company_id, name)
);

alter table crm_tags enable row level security;
create policy "crm_tags_all_own_company" on crm_tags for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create table crm_tag_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references crm_tags (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  customer_id uuid references customers (id) on delete cascade,
  constraint crm_tag_links_one_owner check (
    (lead_id is not null and customer_id is null) or (lead_id is null and customer_id is not null)
  )
);
-- Un PK compuesto sobre (tag_id, lead_id, customer_id) volvería NOT NULL a
-- lead_id/customer_id, contradiciendo el CHECK de arriba (exactamente uno de
-- los dos debe ser null) — por eso el id es un uuid propio y la unicidad
-- "no repetir la misma etiqueta en la misma entidad" se hace con dos índices
-- únicos parciales, uno por cada lado del XOR.
create unique index crm_tag_links_tag_lead_uidx on crm_tag_links (tag_id, lead_id) where lead_id is not null;
create unique index crm_tag_links_tag_customer_uidx on crm_tag_links (tag_id, customer_id) where customer_id is not null;
create index crm_tag_links_lead_id_idx on crm_tag_links (lead_id);
create index crm_tag_links_customer_id_idx on crm_tag_links (customer_id);

alter table crm_tag_links enable row level security;
create policy "crm_tag_links_all_own_company" on crm_tag_links for all
  using (exists (select 1 from crm_tags t where t.id = tag_id and is_company_member(t.company_id)))
  with check (exists (select 1 from crm_tags t where t.id = tag_id and is_company_member(t.company_id)));

-- ---------------------------------------------------------------------------
-- 5. Canales y bandeja de entrada (§4/§5) — SOLO estructura. Sin API real
-- conectada todavía (no hay VPS ni credenciales de Meta/LinkedIn), así que
-- `status` siempre nace 'not_connected' y no hay ningún webhook que escriba
-- en `crm_conversations`/`crm_messages` en esta fase — están listas para
-- cuando se conecte cada canal, no simulan tráfico real (spec §4: "No
-- simular integraciones inexistentes"). Sí se puede registrar una
-- conversación manualmente (ej. una llamada telefónica) mientras tanto.
-- ---------------------------------------------------------------------------
create type crm_channel_type as enum ('whatsapp', 'instagram', 'facebook', 'linkedin', 'email', 'web');
create type crm_channel_status as enum ('not_connected', 'connected');

create table crm_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  channel_type crm_channel_type not null,
  status crm_channel_status not null default 'not_connected',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, channel_type)
);

alter table crm_channels enable row level security;
create policy "crm_channels_all_own_company" on crm_channels for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create type crm_conversation_status as enum ('open', 'pending', 'closed');

create table crm_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  channel_type crm_channel_type not null,
  contact_name text not null,
  contact_handle text,
  lead_id uuid references leads (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  status crm_conversation_status not null default 'open',
  assigned_to uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now()
);
create index crm_conversations_company_id_idx on crm_conversations (company_id, last_message_at desc);

alter table crm_conversations enable row level security;
create policy "crm_conversations_all_own_company" on crm_conversations for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create type crm_message_direction as enum ('inbound', 'outbound');

create table crm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references crm_conversations (id) on delete cascade,
  direction crm_message_direction not null,
  body text not null,
  sender_id uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now()
);
create index crm_messages_conversation_id_idx on crm_messages (conversation_id, sent_at);

alter table crm_messages enable row level security;
create policy "crm_messages_all_own_company" on crm_messages for all
  using (exists (select 1 from crm_conversations c where c.id = conversation_id and is_company_member(c.company_id)))
  with check (exists (select 1 from crm_conversations c where c.id = conversation_id and is_company_member(c.company_id)));

-- ---------------------------------------------------------------------------
-- 6. Feature + límite de plan (§15) — sin precios hardcodeados: el admin
-- decide desde /admin/planes en qué plan se activa 'crm' y cuál es su
-- max_leads (Fase 11 §20/§21, mismo mecanismo que el resto de features).
-- ---------------------------------------------------------------------------
insert into features (key, name, description) values
  ('crm', 'CRM', 'Leads, pipeline de ventas, tareas y bandeja de entrada.')
on conflict (key) do nothing;

insert into plan_limits (plan_id, limit_key, limit_value)
select id, 'max_leads', 0 from plans where code in ('basico')
union all
select id, 'max_leads', 200 from plans where code in ('negocio')
union all
select id, 'max_leads', null from plans where code = 'pro'
on conflict (plan_id, limit_key) do nothing;

insert into plan_features (plan_id, feature_key, enabled)
select p.id, 'crm', true from plans p where p.code in ('negocio', 'pro')
on conflict (plan_id, feature_key) do nothing;

create or replace function get_plan_usage(p_company_id uuid)
returns table (limit_key text, limit_value integer, current_usage integer)
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_month_start timestamptz;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  v_month_start := date_trunc('month', now());

  return query
  select pl.limit_key, pl.limit_value,
    (case pl.limit_key
      when 'max_users' then
        (select count(*)::integer from company_members where company_id = p_company_id and status = 'active')
      when 'max_products' then
        (select count(*)::integer from products where company_id = p_company_id and status = 'active')
      when 'max_customers' then
        (select count(*)::integer from customers where company_id = p_company_id and status = 'active')
      when 'max_orders_month' then
        (select count(*)::integer from orders where company_id = p_company_id and created_at >= v_month_start)
      when 'max_leads' then
        (select count(*)::integer from leads where company_id = p_company_id)
      else 0
    end)::integer
  from plan_limits pl
  join subscriptions s on s.plan_id = pl.plan_id
  where s.company_id = p_company_id;
end;
$$;
grant execute on function get_plan_usage to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Vista 360° del cliente (§3) — compras ya se leen directo de `sales`, acá
-- solo se agregan los conteos que le faltan a esa vista (leads previos,
-- tareas, notas) en una sola consulta reutilizable.
-- ---------------------------------------------------------------------------
create function get_customer_crm_summary(p_customer_id uuid)
returns table (
  leads_count integer, open_tasks_count integer, notes_count integer,
  total_purchases_cents bigint, purchases_count integer, last_purchase_at timestamptz
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    (select count(*)::integer from leads where customer_id = p_customer_id),
    (select count(*)::integer from crm_tasks where customer_id = p_customer_id and done_at is null),
    (select count(*)::integer from crm_notes where customer_id = p_customer_id),
    coalesce((select sum(total_cents) from sales where customer_id = p_customer_id and status = 'completed'), 0)::bigint,
    (select count(*)::integer from sales where customer_id = p_customer_id and status = 'completed'),
    (select max(created_at) from sales where customer_id = p_customer_id and status = 'completed')
  from customers c
  where c.id = p_customer_id and is_company_member(c.company_id);
$$;
grant execute on function get_customer_crm_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Atribución (§22) — de qué canal vino un cliente y cuánto ha comprado,
-- para saber qué canal realmente genera ventas.
-- ---------------------------------------------------------------------------
create function report_attribution_by_channel(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (source lead_source, customers_count integer, total_cents bigint)
language sql security invoker stable set search_path = public as $$
  select c.source, count(distinct c.id)::integer, coalesce(sum(s.total_cents), 0)::bigint
  from customers c
  left join sales s on s.customer_id = c.id and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
  where c.company_id = p_company_id and c.source is not null
    and is_company_member(p_company_id)
  group by c.source
  order by sum(s.total_cents) desc nulls last;
$$;
grant execute on function report_attribution_by_channel to authenticated;
