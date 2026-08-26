-- =============================================================================
-- FASE 13 — Inteligencia artificial y automatizaciones (estructura)
--
-- Esta fase deja la arquitectura y el esquema listos, pero NO conecta un
-- proveedor de IA real ni una instancia de n8n (no hay VPS todavía). Ver
-- docs/fase-13-ia-automatizaciones.md para el detalle de qué falta para
-- poner esto en producción.
--
-- Principio de seguridad (Fase 13 §5/§6): la IA nunca consulta Postgres
-- directamente. Solo puede invocar las funciones ai_get_*() de abajo, cada
-- una security invoker + chequeo is_company_member(), que devuelven
-- exactamente los campos necesarios — nunca la fila completa, nunca datos de
-- otra empresa, nunca contraseñas/tokens/claves.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Límites de plan para IA y automatizaciones (Fase 13 §2) — igual que los
-- demás plan_limits de la Fase 11, null = ilimitado, 0 = no disponible.
-- ---------------------------------------------------------------------------
insert into plan_limits (plan_id, limit_key, limit_value)
select id, 'max_ai_queries_month', 0 from plans where code in ('basico', 'negocio')
union all
select id, 'max_automations_active', 0 from plans where code in ('basico', 'negocio')
union all
select id, 'max_ai_queries_month', 100 from plans where code = 'pro'
union all
select id, 'max_automations_active', 10 from plans where code = 'pro'
on conflict (plan_id, limit_key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. ai_usage (Fase 13 §9) — historial + medición de consumo.
-- ---------------------------------------------------------------------------
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  query text not null,
  response text,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index ai_usage_company_created_idx on ai_usage (company_id, created_at desc);

alter table ai_usage enable row level security;
create policy "ai_usage_select_own_company" on ai_usage for select
  using (is_company_member(company_id));
-- Sin política de insert/update/delete para clientes: solo log_ai_query()
-- (SECURITY DEFINER) escribe aquí, así el conteo del límite mensual no se
-- puede falsear desde el frontend.

-- Uso del mes actual (para el indicador "42 / 100" y el 80%/100% de aviso).
create function get_ai_usage_this_month(p_company_id uuid)
returns integer
language sql
security invoker
stable
set search_path = public
as $$
  select count(*)::integer
  from ai_usage
  where company_id = p_company_id
    and created_at >= date_trunc('month', now())
    and is_company_member(p_company_id);
$$;
grant execute on function get_ai_usage_this_month to authenticated;

-- Registra una consulta IA de forma atómica, respetando el límite del plan
-- (Fase 13 §10) — nunca confiar en un conteo hecho en el cliente.
create function log_ai_query(
  p_company_id uuid,
  p_query text,
  p_response text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer
)
returns ai_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_row ai_usage;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select pl.limit_value into v_limit
    from subscriptions s
    join plan_limits pl on pl.plan_id = s.plan_id and pl.limit_key = 'max_ai_queries_month'
    where s.company_id = p_company_id;

  if v_limit is not null then
    select count(*) into v_used from ai_usage
      where company_id = p_company_id and created_at >= date_trunc('month', now());
    if v_used >= v_limit then
      raise exception 'Has alcanzado tus consultas de IA de este período.';
    end if;
  end if;

  insert into ai_usage (company_id, user_id, query, response, model, input_tokens, output_tokens)
  values (p_company_id, auth.uid(), p_query, p_response, p_model, p_input_tokens, p_output_tokens)
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function log_ai_query to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Capa segura de consulta para la IA (Fase 13 §5) — mismo principio que
-- los report_*() de la Fase 10 (security invoker, respeta RLS, agregación
-- eficiente), con nombres orientados a lo que la IA necesita pedir.
-- ---------------------------------------------------------------------------
create function ai_get_sales_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (total_cents bigint, sales_count integer, avg_ticket_cents bigint)
language sql security invoker stable set search_path = public as $$
  select coalesce(sum(total_cents), 0)::bigint, count(*)::integer,
    case when count(*) > 0 then round(coalesce(sum(total_cents),0)::numeric / count(*))::bigint else 0 end
  from sales
  where company_id = p_company_id and status = 'completed'
    and created_at >= p_start and created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function ai_get_sales_summary to authenticated;

create function ai_get_top_products(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 5)
returns table (name text, quantity numeric, total_cents bigint)
language sql security invoker stable set search_path = public as $$
  select si.name, sum(si.quantity), sum(si.total_cents)::bigint
  from sale_items si
  join sales s on s.id = si.sale_id
  where s.company_id = p_company_id and s.status = 'completed' and si.item_type = 'product'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by si.name
  order by sum(si.total_cents) desc
  limit p_limit;
$$;
grant execute on function ai_get_top_products to authenticated;

create function ai_get_low_stock_products(p_company_id uuid, p_limit integer default 10)
returns table (name text, current_stock numeric, minimum_stock numeric, unit product_unit)
language sql security invoker stable set search_path = public as $$
  select p.name, p.current_stock, p.minimum_stock, p.unit
  from products p
  where p.company_id = p_company_id
    and p.track_inventory = true
    and p.status = 'active'
    and p.current_stock <= p.minimum_stock
    and is_company_member(p_company_id)
  order by (p.current_stock - p.minimum_stock)
  limit p_limit;
$$;
grant execute on function ai_get_low_stock_products to authenticated;

create function ai_get_customer_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 5)
returns table (customer_name text, purchases_count integer, total_cents bigint)
language sql security invoker stable set search_path = public as $$
  select trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    count(s.id)::integer, coalesce(sum(s.total_cents),0)::bigint
  from customers c
  join sales s on s.customer_id = c.id
  where c.company_id = p_company_id and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by c.id, c.first_name, c.last_name
  order by sum(s.total_cents) desc
  limit p_limit;
$$;
grant execute on function ai_get_customer_summary to authenticated;

create function ai_get_order_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (received integer, delivered integer, canceled integer, pending integer, total_value_cents bigint)
language sql security invoker stable set search_path = public as $$
  select count(*)::integer,
    count(*) filter (where status = 'delivered')::integer,
    count(*) filter (where status = 'canceled')::integer,
    count(*) filter (where status = 'pending')::integer,
    coalesce(sum(total_cents), 0)::bigint
  from orders
  where company_id = p_company_id and created_at >= p_start and created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function ai_get_order_summary to authenticated;

create function ai_get_expense_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (total_cents bigint, top_category text, top_category_cents bigint)
language plpgsql security invoker stable set search_path = public as $$
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  return query
  with by_category as (
    select coalesce(ec.name, 'Sin categoría') as category_name, sum(e.amount_cents) as cents
    from expenses e
    left join expense_categories ec on ec.id = e.category_id
    where e.company_id = p_company_id and e.status = 'registered'
      and e.spent_at >= p_start and e.spent_at < p_end
    group by ec.name
    order by sum(e.amount_cents) desc
  )
  select
    coalesce((select sum(cents) from by_category), 0)::bigint,
    (select category_name from by_category order by cents desc limit 1),
    (select cents from by_category order by cents desc limit 1)::bigint;
end;
$$;
grant execute on function ai_get_expense_summary to authenticated;

create function ai_get_cash_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (income_cents bigint, expense_cents bigint, balance_cents bigint)
language sql security invoker stable set search_path = public as $$
  select
    coalesce(sum(amount_cents) filter (where movement_type = 'income'), 0)::bigint,
    coalesce(sum(amount_cents) filter (where movement_type = 'expense'), 0)::bigint,
    coalesce(sum(amount_cents), 0)::bigint
  from cash_movements
  where company_id = p_company_id and created_at >= p_start and created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function ai_get_cash_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Automatizaciones (Fase 13 §13/§14/§15/§16/§20/§22)
-- ---------------------------------------------------------------------------
create type automation_status as enum ('active', 'paused', 'error');

create type automation_trigger as enum (
  'new_order', 'order_status_changed', 'sale_created', 'low_stock', 'customer_created',
  'appointment_created', 'appointment_upcoming', 'expense_created', 'daily_schedule', 'weekly_schedule'
);

create type automation_action_type as enum ('notification', 'email', 'webhook', 'create_task', 'ai_summary');

create table automations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  trigger_type automation_trigger not null,
  -- Condición opcional evaluada antes de ejecutar la acción (Fase 13 §14), ej.
  -- {"field": "stock", "operator": "<=", "value_field": "minimum_stock"}.
  condition jsonb not null default '{}'::jsonb,
  action_type automation_action_type not null,
  -- Configuración de la acción, ej. {"channel": "notification", "message": "..."} o
  -- {"webhook_url": "https://n8n.ejemplo.com/webhook/..."}.
  action_config jsonb not null default '{}'::jsonb,
  status automation_status not null default 'active',
  template_key text,
  consecutive_errors integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automations_company_id_idx on automations (company_id);

alter table automations enable row level security;
create policy "automations_all_own_company" on automations for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- Crea una automatización respetando el límite de "activas" del plan (Fase 13
-- §20 — activas, no ejecuciones) de forma atómica.
create function create_automation(
  p_company_id uuid,
  p_name text,
  p_trigger_type automation_trigger,
  p_condition jsonb,
  p_action_type automation_action_type,
  p_action_config jsonb,
  p_template_key text default null
)
returns automations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_active_count integer;
  v_row automations;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select pl.limit_value into v_limit
    from subscriptions s
    join plan_limits pl on pl.plan_id = s.plan_id and pl.limit_key = 'max_automations_active'
    where s.company_id = p_company_id;

  if coalesce(v_limit, 0) = 0 then
    raise exception 'Tu plan no incluye automatizaciones. Actualiza tu plan para activarlas.';
  end if;

  if v_limit is not null then
    select count(*) into v_active_count from automations
      where company_id = p_company_id and status = 'active';
    if v_active_count >= v_limit then
      raise exception 'Has alcanzado el límite de automatizaciones activas de tu plan (%).', v_limit;
    end if;
  end if;

  insert into automations (company_id, name, trigger_type, condition, action_type, action_config, template_key, created_by)
  values (p_company_id, p_name, p_trigger_type, coalesce(p_condition, '{}'::jsonb), p_action_type,
    coalesce(p_action_config, '{}'::jsonb), p_template_key, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function create_automation to authenticated;

create function set_automation_status(p_automation_id uuid, p_status automation_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from automations where id = p_automation_id;
  if v_company_id is null or not is_company_member(v_company_id) then
    raise exception 'No encontramos esa automatización.';
  end if;

  update automations
    set status = p_status,
        consecutive_errors = case when p_status = 'active' then 0 else consecutive_errors end,
        updated_at = now()
    where id = p_automation_id;
end;
$$;
grant execute on function set_automation_status to authenticated;

-- ---------------------------------------------------------------------------
-- 5. automation_usage (Fase 13 §21) — un registro por ejecución. Lo escribe
-- el servidor de bizko (nunca el navegador) cuando despacha el evento y
-- cuando recibe el resultado desde n8n — ver docs/fase-13-ia-automatizaciones.md.
-- ---------------------------------------------------------------------------
create type automation_execution_status as enum ('pending', 'running', 'success', 'failed');

create table automation_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  automation_id uuid not null references automations (id) on delete cascade,
  execution_id text,
  status automation_execution_status not null default 'pending',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);
create index automation_usage_automation_id_idx on automation_usage (automation_id, started_at desc);
create index automation_usage_company_id_idx on automation_usage (company_id, started_at desc);

alter table automation_usage enable row level security;
create policy "automation_usage_select_own_company" on automation_usage for select
  using (is_company_member(company_id));
-- Sin insert/update de cliente: solo el backend de bizko (service role, fuera
-- de RLS) escribe aquí al despachar/recibir resultados de n8n.

-- Marca una automatización como "necesita atención" tras fallos consecutivos
-- (Fase 13 §22) — la llama el backend al recibir un resultado 'failed'.
create function register_automation_execution(
  p_automation_id uuid,
  p_execution_id text,
  p_status automation_execution_status,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_errors integer;
begin
  select company_id into v_company_id from automations where id = p_automation_id;
  if v_company_id is null then
    raise exception 'Automatización no encontrada.';
  end if;

  insert into automation_usage (company_id, automation_id, execution_id, status, completed_at, error)
  values (v_company_id, p_automation_id, p_execution_id, p_status,
    case when p_status in ('success','failed') then now() else null end, p_error);

  if p_status = 'failed' then
    update automations set consecutive_errors = consecutive_errors + 1, updated_at = now()
      where id = p_automation_id
      returning consecutive_errors into v_errors;
    if v_errors >= 3 then
      update automations set status = 'error', updated_at = now() where id = p_automation_id;
    end if;
  elsif p_status = 'success' then
    update automations set consecutive_errors = 0, updated_at = now() where id = p_automation_id;
  end if;
end;
$$;
-- Sin grant a authenticated: la invoca el backend de bizko con el service
-- role (webhook de callback de n8n), nunca el navegador de un usuario.

-- ---------------------------------------------------------------------------
-- 6. Centro de notificaciones (Fase 13 §27)
-- ---------------------------------------------------------------------------
create type notification_type as enum (
  'low_stock', 'new_order', 'automation_executed', 'automation_error', 'ai_limit_warning'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;
create policy "notifications_select_own" on notifications for select
  using (user_id = auth.uid() and is_company_member(company_id));
create policy "notifications_update_own" on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. Secreto de webhook por empresa (Fase 13 §18/§19) — usado para firmar
-- (HMAC) los eventos que bizko envía a n8n, así n8n puede validar que el
-- evento realmente viene de bizko y no fue manipulado. Solo el dueño puede
-- verlo (lo necesita para configurarlo en su workflow de n8n); nunca se lee
-- desde código de cliente en el bundle de la app, solo se muestra una vez en
-- una pantalla de configuración protegida.
-- ---------------------------------------------------------------------------
create table automation_webhook_secrets (
  company_id uuid primary key references companies (id) on delete cascade,
  secret text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

alter table automation_webhook_secrets enable row level security;
create policy "automation_webhook_secrets_owner_select" on automation_webhook_secrets for select
  using (is_company_owner(company_id));

create function get_or_create_webhook_secret(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if not is_company_owner(p_company_id) then
    raise exception 'Solo el dueño puede ver esta información.';
  end if;

  select secret into v_secret from automation_webhook_secrets where company_id = p_company_id;
  if v_secret is null then
    insert into automation_webhook_secrets (company_id) values (p_company_id) returning secret into v_secret;
  end if;
  return v_secret;
end;
$$;
grant execute on function get_or_create_webhook_secret to authenticated;
