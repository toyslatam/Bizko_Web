-- =============================================================================
-- FASE — Marketing (sobre el CORE + CRM de bizko)
--
-- Campañas, calendario, audiencias/segmentos y créditos quedan completos y
-- funcionales — no dependen de ningún proveedor externo. Generación real de
-- contenido con IA, imágenes y video SÍ dependen de proveedores externos que
-- todavía no están conectados (igual que el asistente de IA de la Fase 13):
-- se deja la tabla `marketing_campaign_content` lista para guardar contenido
-- (escrito a mano hoy, generado por IA cuando se conecte un proveedor), y
-- `marketing_credit_costs` ya modela el costo de cada acción para cuando esa
-- generación exista de verdad. Ver docs/fase-crm-marketing.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Campañas (§9/§17) — objetivo, audiencia y estado de aprobación humana.
-- ---------------------------------------------------------------------------
create type campaign_objective as enum (
  'generate_leads', 'sell_product', 'launch_product', 'recover_customers',
  'increase_ticket', 'promote_season', 'increase_visits', 'loyalty'
);

create type campaign_audience_type as enum (
  'all_customers', 'new_customers', 'frequent_customers', 'inactive_customers',
  'category_buyers', 'product_buyers', 'leads', 'custom_segment'
);

create type campaign_status as enum ('draft', 'review', 'approved', 'scheduled', 'published', 'finished');

create table marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  objective campaign_objective not null,
  audience_type campaign_audience_type not null,
  -- ej. {"category_id": "..."} o {"segment_id": "..."} según audience_type.
  audience_config jsonb not null default '{}'::jsonb,
  channels crm_channel_type[] not null default '{}',
  status campaign_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_campaigns_company_id_idx on marketing_campaigns (company_id, status);
create index marketing_campaigns_scheduled_idx on marketing_campaigns (company_id, scheduled_at);

alter table marketing_campaigns enable row level security;
create policy "marketing_campaigns_all_own_company" on marketing_campaigns for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- Únicas transiciones válidas del flujo de aprobación (§17) — nunca se salta
-- directo de borrador a publicada desde el frontend.
create function set_campaign_status(p_campaign_id uuid, p_status campaign_status)
returns marketing_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign marketing_campaigns;
  v_flow campaign_status[] := array['draft','review','approved','scheduled','published','finished'];
  v_current_idx integer;
  v_new_idx integer;
begin
  select * into v_campaign from marketing_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null or not is_company_member(v_campaign.company_id) then
    raise exception 'Campaña no encontrada.';
  end if;

  v_current_idx := array_position(v_flow, v_campaign.status);
  v_new_idx := array_position(v_flow, p_status);

  if v_new_idx is null or v_new_idx not in (v_current_idx + 1, v_current_idx - 1) then
    raise exception 'No puedes pasar de % a % directamente.', v_campaign.status, p_status;
  end if;

  update marketing_campaigns set
    status = p_status,
    published_at = case when p_status = 'published' and v_campaign.published_at is null then now() else v_campaign.published_at end,
    updated_at = now()
  where id = p_campaign_id
  returning * into v_campaign;

  return v_campaign;
end;
$$;
grant execute on function set_campaign_status to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Contenido de campaña (§10) — texto/creatividad por canal. `generated_by`
-- distingue lo escrito a mano de lo generado por IA (cuando exista).
-- ---------------------------------------------------------------------------
create type campaign_content_type as enum (
  'post', 'caption', 'whatsapp_message', 'ad', 'story', 'title', 'cta'
);
create type content_origin as enum ('manual', 'ai');

create table marketing_campaign_content (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references marketing_campaigns (id) on delete cascade,
  channel crm_channel_type,
  content_type campaign_content_type not null,
  body text not null,
  media_url text,
  generated_by content_origin not null default 'manual',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index marketing_campaign_content_campaign_id_idx on marketing_campaign_content (campaign_id);

alter table marketing_campaign_content enable row level security;
create policy "marketing_campaign_content_all_own_company" on marketing_campaign_content for all
  using (exists (select 1 from marketing_campaigns c where c.id = campaign_id and is_company_member(c.company_id)))
  with check (exists (select 1 from marketing_campaigns c where c.id = campaign_id and is_company_member(c.company_id)));

-- ---------------------------------------------------------------------------
-- 3. Segmentos (§19) — condiciones sobre un catálogo cerrado de tipos
-- conocidos (no un constructor de queries genérico): suficiente para los
-- ejemplos del spec, y `count_segment_customers()` sabe evaluarlos todos.
-- ---------------------------------------------------------------------------
create type segment_condition_type as enum (
  'purchased_last_days', 'inactive_days', 'category_id', 'min_total_spent', 'lead_source'
);

create table marketing_segments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  condition_type segment_condition_type not null,
  -- ej. {"days": 30} / {"category_id": "..."} / {"min_cents": 100000} / {"source": "instagram"}
  condition_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table marketing_segments enable row level security;
create policy "marketing_segments_all_own_company" on marketing_segments for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create function count_segment_customers(p_company_id uuid, p_condition_type segment_condition_type, p_condition_value jsonb)
returns integer
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  case p_condition_type
    when 'purchased_last_days' then
      select count(distinct c.id) into v_count from customers c
        join sales s on s.customer_id = c.id and s.status = 'completed'
        where c.company_id = p_company_id
          and s.created_at >= now() - make_interval(days => (p_condition_value->>'days')::integer);
    when 'inactive_days' then
      select count(*) into v_count from customers c
        where c.company_id = p_company_id and c.status = 'active'
          and not exists (
            select 1 from sales s where s.customer_id = c.id and s.status = 'completed'
              and s.created_at >= now() - make_interval(days => (p_condition_value->>'days')::integer)
          );
    when 'category_id' then
      select count(distinct c.id) into v_count from customers c
        join sales s on s.customer_id = c.id and s.status = 'completed'
        join sale_items si on si.sale_id = s.id
        join products p on p.id = si.product_id
        where c.company_id = p_company_id and p.category_id = (p_condition_value->>'category_id')::uuid;
    when 'min_total_spent' then
      select count(*) into v_count from (
        select c.id from customers c
          join sales s on s.customer_id = c.id and s.status = 'completed'
          where c.company_id = p_company_id
          group by c.id
          having sum(s.total_cents) >= (p_condition_value->>'min_cents')::integer
      ) matched;
    when 'lead_source' then
      select count(*) into v_count from customers c
        where c.company_id = p_company_id and c.source = (p_condition_value->>'source')::lead_source;
    else
      v_count := 0;
  end case;

  return coalesce(v_count, 0);
end;
$$;
grant execute on function count_segment_customers to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Créditos de marketing (§14) — ledger real, sin generación ilimitada.
-- Costos configurables por Super Admin, nunca hardcodeados en el frontend.
-- ---------------------------------------------------------------------------
create type marketing_credit_action as enum ('image', 'video', 'content', 'campaign');

create table marketing_credit_costs (
  action_type marketing_credit_action primary key,
  credits_cost integer not null
);
insert into marketing_credit_costs (action_type, credits_cost) values
  ('content', 1), ('image', 5), ('video', 20), ('campaign', 2)
on conflict (action_type) do nothing;

alter table marketing_credit_costs enable row level security;
create policy "marketing_credit_costs_select_all" on marketing_credit_costs for select using (true);
create policy "marketing_credit_costs_admin_manage" on marketing_credit_costs for all
  using (is_platform_admin()) with check (is_platform_admin());

create table marketing_credits (
  company_id uuid primary key references companies (id) on delete cascade,
  balance integer not null default 0,
  resets_at timestamptz not null default (date_trunc('month', now()) + interval '1 month')
);

alter table marketing_credits enable row level security;
create policy "marketing_credits_select_own_company" on marketing_credits for select
  using (is_company_member(company_id));

create type marketing_credit_reference as enum ('campaign', 'campaign_content');

create table marketing_credit_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  action_type marketing_credit_action not null,
  credits_spent integer not null,
  reference_type marketing_credit_reference,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index marketing_credit_usage_company_id_idx on marketing_credit_usage (company_id, created_at desc);

alter table marketing_credit_usage enable row level security;
create policy "marketing_credit_usage_select_own_company" on marketing_credit_usage for select
  using (is_company_member(company_id));

-- Recarga mensual perezosa (§14) — no hay cron todavía, así que se evalúa
-- cada vez que se consulta/gasta si ya tocaba resetear el período.
create function get_marketing_credits(p_company_id uuid)
returns marketing_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row marketing_credits;
  v_allowance integer;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select pl.limit_value into v_allowance
    from subscriptions s
    join plan_limits pl on pl.plan_id = s.plan_id and pl.limit_key = 'max_marketing_credits_month'
    where s.company_id = p_company_id;
  v_allowance := coalesce(v_allowance, 0);

  select * into v_row from marketing_credits where company_id = p_company_id for update;
  if v_row.company_id is null then
    insert into marketing_credits (company_id, balance, resets_at)
    values (p_company_id, v_allowance, date_trunc('month', now()) + interval '1 month')
    returning * into v_row;
  elsif v_row.resets_at <= now() then
    update marketing_credits set balance = v_allowance, resets_at = date_trunc('month', now()) + interval '1 month'
      where company_id = p_company_id
      returning * into v_row;
  end if;

  return v_row;
end;
$$;
grant execute on function get_marketing_credits to authenticated;

create function spend_marketing_credits(
  p_company_id uuid,
  p_action_type marketing_credit_action,
  p_reference_type marketing_credit_reference default null,
  p_reference_id uuid default null
)
returns marketing_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits marketing_credits;
  v_cost integer;
begin
  v_credits := get_marketing_credits(p_company_id);

  select credits_cost into v_cost from marketing_credit_costs where action_type = p_action_type;
  v_cost := coalesce(v_cost, 0);

  if v_credits.balance < v_cost then
    raise exception 'No tienes suficientes créditos de marketing. Te quedan %.', v_credits.balance;
  end if;

  update marketing_credits set balance = balance - v_cost where company_id = p_company_id
    returning * into v_credits;

  insert into marketing_credit_usage (company_id, action_type, credits_spent, reference_type, reference_id)
  values (p_company_id, p_action_type, v_cost, p_reference_type, p_reference_id);

  return v_credits;
end;
$$;
grant execute on function spend_marketing_credits to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Feature + plan (§15) — "Plan Marketing" se crea desde /admin/planes
-- (Fase 11, ya soporta crear planes nuevos sin tocar código); acá solo se
-- agrega el feature al catálogo y un límite conservador (0) a los planes
-- existentes para que no se habilite solo por accidente.
-- ---------------------------------------------------------------------------
insert into features (key, name, description) values
  ('marketing', 'Marketing', 'Campañas, calendario, segmentos y generación de contenido.')
on conflict (key) do nothing;

insert into plan_limits (plan_id, limit_key, limit_value)
select id, 'max_marketing_credits_month', 0 from plans
on conflict (plan_id, limit_key) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Permiso de CRM/Marketing en RLS de negocio ya cubierto por
-- is_company_member() en todas las tablas de arriba — el filtrado fino de UI
-- (quién ve el botón "Nueva campaña") vive en src/lib/permissions.ts, como el
-- resto del CORE.
-- ---------------------------------------------------------------------------
