-- =============================================================================
-- FASE 12 — Super Admin y administración global de bizko
--
-- SUPER_ADMIN ya existe como concepto separado de las empresas desde la Fase
-- 2: la tabla `platform_admins` (independiente de company_id) + la función
-- `is_platform_admin()`. Esa función ya está incluida en `is_company_member()`
-- / `is_company_owner()`, así que un platform admin YA puede leer y escribir
-- cualquier fila de cualquier empresa a través de las políticas RLS
-- existentes (§24/§25 quedan cubiertos sin abrir ninguna política nueva "para
-- cualquiera"). Lo que falta es:
--   1. Agregación eficiente cross-company (no se puede hacer fila por fila
--      respetando RLS sin traer miles de filas al navegador, ver §30).
--   2. Un registro de auditoría para las acciones administrativas (§19).
--   3. Preparar `subscriptions` para un futuro proveedor de pagos (§28).
-- Todas las funciones admin_* son SECURITY DEFINER pero validan
-- is_platform_admin() como primera línea — si un usuario normal las invoca,
-- reciben una excepción, nunca datos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. admin_audit_logs (Fase 12 §19)
-- ---------------------------------------------------------------------------
create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  company_id uuid references companies (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_at_idx on admin_audit_logs (created_at desc);
create index admin_audit_logs_company_id_idx on admin_audit_logs (company_id);

alter table admin_audit_logs enable row level security;
create policy "admin_audit_logs_admin_select" on admin_audit_logs for select
  using (is_platform_admin());
-- Sin política de insert/update/delete para usuarios: solo las funciones
-- SECURITY DEFINER de este archivo escriben aquí (vía admin_log_action()).

create function admin_log_action(
  p_admin_user_id uuid, p_action text, p_target_type text,
  p_target_id uuid, p_company_id uuid, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into admin_audit_logs (admin_user_id, action, target_type, target_id, company_id, metadata)
  values (p_admin_user_id, p_action, p_target_type, p_target_id, p_company_id, p_metadata);
$$;

-- ---------------------------------------------------------------------------
-- 2. subscriptions: preparación para un futuro proveedor de pagos (§28) — no
-- se integra Stripe/PayPal todavía, solo se deja el esquema listo.
-- ---------------------------------------------------------------------------
alter table subscriptions add column provider text;
alter table subscriptions add column provider_customer_id text;
alter table subscriptions add column provider_subscription_id text;
alter table subscriptions add column billing_cycle text not null default 'monthly';
alter table subscriptions add column next_billing_date timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Dashboard global (§3/§4)
-- ---------------------------------------------------------------------------
create function admin_dashboard_metrics()
returns table (
  companies_total integer,
  companies_active integer,
  companies_trial integer,
  companies_suspended integer,
  users_total integer,
  subscriptions_active integer,
  mrr_cents bigint,
  new_companies_month integer,
  canceled_month integer,
  orders_month integer,
  sales_month integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now());
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  select
    (select count(*)::integer from companies),
    (select count(*)::integer from subscriptions where status = 'active'),
    (select count(*)::integer from subscriptions where status = 'trial'),
    (select count(*)::integer from subscriptions where status = 'suspended'),
    (select count(*)::integer from profiles),
    (select count(*)::integer from subscriptions where status = 'active'),
    -- MRR: solo suscripciones activas con pago real — nunca trial, suspendida
    -- o cancelada (Fase 12 §4).
    (select coalesce(sum(p.price_monthly_cents), 0)::bigint
       from subscriptions s join plans p on p.id = s.plan_id where s.status = 'active'),
    (select count(*)::integer from companies where created_at >= v_month_start),
    (select count(*)::integer from subscriptions where status = 'canceled' and updated_at >= v_month_start),
    (select count(*)::integer from orders where created_at >= v_month_start),
    (select count(*)::integer from sales where created_at >= v_month_start and status = 'completed');
end;
$$;
grant execute on function admin_dashboard_metrics to authenticated;

-- Distribución por tipo de negocio (§22).
create function admin_business_type_distribution()
returns table (business_type business_type, companies_count integer)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  select c.business_type, count(*)::integer
  from companies c
  group by c.business_type
  order by count(*) desc;
end;
$$;
grant execute on function admin_business_type_distribution to authenticated;

-- Uso agregado de la plataforma por período (§17) — nunca se descargan filas
-- crudas al navegador, todo es un conteo agregado en Postgres.
create function admin_usage_metrics(p_start timestamptz, p_end timestamptz)
returns table (
  active_companies integer,
  active_users integer,
  products_count integer,
  sales_count integer,
  orders_count integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  select
    (select count(distinct company_id)::integer from sales where created_at >= p_start and created_at < p_end),
    (select count(*)::integer from company_members where status = 'active'),
    (select count(*)::integer from products where status = 'active'),
    (select count(*)::integer from sales where created_at >= p_start and created_at < p_end and status = 'completed'),
    (select count(*)::integer from orders where created_at >= p_start and created_at < p_end);
end;
$$;
grant execute on function admin_usage_metrics to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Empresas (§5/§6) — listado paginado + búsqueda + filtros. El cálculo de
-- "última actividad" solo corre sobre la página ya paginada (subconsulta
-- correlacionada limitada a p_limit filas), no sobre toda la tabla, para
-- escalar a miles de empresas (§30).
-- ---------------------------------------------------------------------------
create function admin_list_companies(
  p_search text default null,
  p_plan_code text default null,
  p_business_type text default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  business_type business_type,
  owner_name text,
  owner_email text,
  plan_name text,
  status subscription_status,
  created_at timestamptz,
  last_activity timestamptz,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  with filtered as (
    select
      c.id, c.name, c.business_type, c.created_at,
      s.status as sub_status,
      p.name as plan_name,
      p.code as plan_code,
      cm.user_id as owner_user_id
    from companies c
    left join subscriptions s on s.company_id = c.id
    left join plans p on p.id = s.plan_id
    left join company_members cm on cm.company_id = c.id and cm.role = 'owner'
    left join profiles prof_search on prof_search.id = cm.user_id
    where (p_search is null or c.name ilike '%' || p_search || '%' or prof_search.email ilike '%' || p_search || '%')
      and (p_plan_code is null or p.code::text = p_plan_code)
      and (p_business_type is null or c.business_type::text = p_business_type)
      and (p_status is null or s.status::text = p_status)
  ),
  counted as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered
    order by created_at desc
    limit p_limit offset p_offset
  )
  select
    counted.id, counted.name, counted.business_type,
    nullif(trim(coalesce(prof.first_name, '') || ' ' || coalesce(prof.last_name, '')), ''),
    prof.email,
    counted.plan_name, counted.sub_status, counted.created_at,
    greatest(
      counted.created_at,
      coalesce((select max(sa.created_at) from sales sa where sa.company_id = counted.id), counted.created_at),
      coalesce((select max(o.created_at) from orders o where o.company_id = counted.id), counted.created_at)
    ),
    counted.total_count
  from counted
  left join profiles prof on prof.id = counted.owner_user_id;
end;
$$;
grant execute on function admin_list_companies to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Usuarios (§13)
-- ---------------------------------------------------------------------------
create function admin_list_users(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  company_name text,
  role user_role,
  member_status member_status,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  select
    prof.id,
    nullif(trim(coalesce(prof.first_name, '') || ' ' || coalesce(prof.last_name, '')), ''),
    prof.email,
    c.name,
    cm.role,
    cm.status,
    prof.created_at,
    count(*) over ()::bigint
  from profiles prof
  left join company_members cm on cm.user_id = prof.id
  left join companies c on c.id = cm.company_id
  where (
    p_search is null
    or prof.email ilike '%' || p_search || '%'
    or prof.first_name ilike '%' || p_search || '%'
    or prof.last_name ilike '%' || p_search || '%'
  )
  order by prof.created_at desc
  limit p_limit offset p_offset;
end;
$$;
grant execute on function admin_list_users to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Suscripciones (§8)
-- ---------------------------------------------------------------------------
create function admin_list_subscriptions(
  p_status text default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  company_id uuid,
  company_name text,
  plan_id uuid,
  plan_name text,
  plan_code plan_code,
  status subscription_status,
  price_monthly_cents integer,
  start_date timestamptz,
  trial_ends_at timestamptz,
  end_date timestamptz,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  select
    c.id, c.name, p.id, p.name, p.code, s.status, p.price_monthly_cents,
    s.start_date, s.trial_ends_at, s.end_date,
    count(*) over ()::bigint
  from subscriptions s
  join companies c on c.id = s.company_id
  join plans p on p.id = s.plan_id
  where (p_status is null or s.status::text = p_status)
    and (p_search is null or c.name ilike '%' || p_search || '%')
  order by s.created_at desc
  limit p_limit offset p_offset;
end;
$$;
grant execute on function admin_list_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Acciones administrativas con auditoría (§9/§10/§11/§12) — cada una
-- valida is_platform_admin(), aplica el cambio y registra la auditoría en la
-- misma transacción.
-- ---------------------------------------------------------------------------
create function admin_change_plan(p_company_id uuid, p_new_plan_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_plan_id uuid;
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  select plan_id into v_old_plan_id from subscriptions where company_id = p_company_id;
  if v_old_plan_id is null then
    raise exception 'Esta empresa no tiene una suscripción.';
  end if;

  update subscriptions set plan_id = p_new_plan_id, updated_at = now() where company_id = p_company_id;

  perform admin_log_action(
    auth.uid(), 'PLAN_CHANGED', 'subscription', p_company_id, p_company_id,
    jsonb_build_object('old_plan_id', v_old_plan_id, 'new_plan_id', p_new_plan_id, 'reason', p_reason)
  );
end;
$$;
grant execute on function admin_change_plan to authenticated;

create function admin_start_trial(p_company_id uuid, p_days integer default 14)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  update subscriptions
    set status = 'trial', trial_ends_at = now() + (p_days || ' days')::interval, updated_at = now()
    where company_id = p_company_id;

  perform admin_log_action(
    auth.uid(), 'TRIAL_STARTED', 'subscription', p_company_id, p_company_id, jsonb_build_object('days', p_days)
  );
end;
$$;
grant execute on function admin_start_trial to authenticated;

create function admin_extend_trial(p_company_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current timestamptz;
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  select trial_ends_at into v_current from subscriptions where company_id = p_company_id;
  update subscriptions
    set trial_ends_at = greatest(coalesce(v_current, now()), now()) + (p_days || ' days')::interval, updated_at = now()
    where company_id = p_company_id;

  perform admin_log_action(
    auth.uid(), 'TRIAL_EXTENDED', 'subscription', p_company_id, p_company_id, jsonb_build_object('days', p_days)
  );
end;
$$;
grant execute on function admin_extend_trial to authenticated;

create function admin_end_trial(p_company_id uuid, p_new_status subscription_status default 'active')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  update subscriptions
    set status = p_new_status, trial_ends_at = null, updated_at = now()
    where company_id = p_company_id;

  perform admin_log_action(
    auth.uid(), 'TRIAL_ENDED', 'subscription', p_company_id, p_company_id, jsonb_build_object('new_status', p_new_status)
  );
end;
$$;
grant execute on function admin_end_trial to authenticated;

create function admin_suspend_company(p_company_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  update subscriptions set status = 'suspended', updated_at = now() where company_id = p_company_id;

  perform admin_log_action(
    auth.uid(), 'COMPANY_SUSPENDED', 'company', p_company_id, p_company_id, jsonb_build_object('reason', p_reason)
  );
end;
$$;
grant execute on function admin_suspend_company to authenticated;

create function admin_reactivate_company(p_company_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'No autorizado.';
  end if;

  update subscriptions set status = 'active', updated_at = now() where company_id = p_company_id;

  perform admin_log_action(
    auth.uid(), 'COMPANY_REACTIVATED', 'company', p_company_id, p_company_id, jsonb_build_object('reason', p_reason)
  );
end;
$$;
grant execute on function admin_reactivate_company to authenticated;

-- ---------------------------------------------------------------------------
-- 8. create_company_with_owner(): agrega COMPANY_CREATED + SUBSCRIPTION_
-- CREATED a la auditoría (§18 "Actividad de la plataforma"). Mismo cuerpo que
-- la versión de la Fase 11, con el registro de auditoría al final.
-- ---------------------------------------------------------------------------
create or replace function create_company_with_owner(
  p_name text,
  p_slug text,
  p_business_type business_type,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_country text default 'CO',
  p_currency text default 'COP',
  p_timezone text default 'America/Bogota'
)
returns companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
  v_basic_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear un negocio.';
  end if;

  insert into companies (name, slug, business_type, phone, email, address, city, country, currency, timezone)
  values (p_name, p_slug, p_business_type, p_phone, p_email, p_address, p_city, p_country, p_currency, p_timezone)
  returning * into v_company;

  insert into company_members (company_id, user_id, role, status)
  values (v_company.id, auth.uid(), 'owner', 'active');

  select id into v_basic_plan_id from plans where code = 'basico';
  insert into subscriptions (company_id, plan_id, status, start_date, trial_ends_at)
  values (v_company.id, v_basic_plan_id, 'trial', now(), now() + interval '14 days');

  insert into profiles (id, email)
  values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (id) do nothing;

  perform admin_log_action(auth.uid(), 'COMPANY_CREATED', 'company', v_company.id, v_company.id,
    jsonb_build_object('name', v_company.name, 'business_type', v_company.business_type));
  perform admin_log_action(auth.uid(), 'SUBSCRIPTION_CREATED', 'subscription', v_company.id, v_company.id,
    jsonb_build_object('plan_id', v_basic_plan_id, 'status', 'trial'));

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. handle_new_user(): agrega USER_CREATED a la auditoría. Mismo cuerpo que
-- la versión de la Fase 2.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  perform admin_log_action(new.id, 'USER_CREATED', 'user', new.id, null,
    jsonb_build_object('email', new.email));

  return new;
end;
$$;
