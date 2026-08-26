-- bizko — Fase 2: autenticación, empresas multi-tenant reales
--
-- Reemplaza app_users (perfil + 1 sola company_id) por un modelo que soporta
-- que un usuario pertenezca a varias empresas en el futuro:
--   profiles         perfil de usuario, 1:1 con auth.users
--   company_members  relación usuario<->empresa con rol y estado
--   platform_admins  super admins de la plataforma (independiente de empresas)

create type member_status as enum ('active', 'invited', 'inactive');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Caché de solo-lectura del correo de auth.users, para poder mostrarlo en
  -- listas de equipo sin exponer el esquema `auth`. La fuente de verdad del
  -- login sigue siendo Supabase Auth; esto nunca se usa para autenticar.
  email text not null,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role user_role not null default 'owner',
  status member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_company_id_idx on company_members (company_id);
create index company_members_user_id_idx on company_members (user_id);

create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Campos adicionales de empresa que pide la Fase 2.
alter table companies
  add column if not exists email text,
  add column if not exists city text,
  add column if not exists country text not null default 'CO',
  add column if not exists timezone text not null default 'America/Bogota',
  add column if not exists updated_at timestamptz not null default now();

-- =========================================================================
-- Retirar el modelo de un solo tenant de la Fase 1.
-- El CASCADE elimina automáticamente las políticas de RLS que llamaban a
-- estas funciones; se recrean más abajo sobre el nuevo modelo.
-- =========================================================================
drop function if exists current_company_id() cascade;
drop function if exists current_user_role() cascade;
drop function if exists is_super_admin() cascade;
drop table if exists app_users cascade;

-- sales.user_id y cash_registers.opened_by apuntaban a app_users; ahora
-- referencian directamente a auth.users.
alter table sales
  add constraint sales_user_id_fkey foreign key (user_id) references auth.users (id);
alter table cash_registers
  add constraint cash_registers_opened_by_fkey foreign key (opened_by) references auth.users (id);

-- =========================================================================
-- HELPERS de RLS (nuevo modelo)
-- =========================================================================
create function is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create function is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from company_members
      where company_id = target_company_id
        and user_id = auth.uid()
        and status = 'active'
    )
    or is_platform_admin();
$$;

create function is_company_owner(target_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from company_members
      where company_id = target_company_id
        and user_id = auth.uid()
        and role = 'owner'
        and status = 'active'
    )
    or is_platform_admin();
$$;

-- =========================================================================
-- RPC: crear una empresa y su primer miembro (owner) en una sola transacción.
-- Evita el problema de "huevo y gallina" de RLS (no puedes insertar tu
-- membresía si todavía no hay ninguna fila que demuestre que perteneces a
-- la empresa). Asigna automáticamente el plan Básico.
-- =========================================================================
create function create_company_with_owner(
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
  insert into subscriptions (company_id, plan_id, status)
  values (v_company.id, v_basic_plan_id, 'active');

  insert into profiles (id, email)
  values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (id) do nothing;

  return v_company;
end;
$$;

grant execute on function create_company_with_owner to authenticated;

-- Crea automáticamente el perfil al registrarse (nombre desde el metadata
-- de signUp o desde el correo como respaldo).
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================================
-- RLS: profiles, company_members, platform_admins
-- =========================================================================
alter table profiles enable row level security;
alter table company_members enable row level security;
alter table platform_admins enable row level security;

create policy "profiles_select_self_teammates_or_admin" on profiles for select
  using (
    id = auth.uid()
    or is_platform_admin()
    or exists (
      select 1 from company_members cm1
      join company_members cm2 on cm1.company_id = cm2.company_id
      where cm1.user_id = auth.uid() and cm1.status = 'active'
        and cm2.user_id = profiles.id and cm2.status = 'active'
    )
  );

create policy "profiles_insert_self" on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_self" on profiles for update
  using (id = auth.uid() or is_platform_admin());

create policy "company_members_select_self_or_teammate" on company_members for select
  using (user_id = auth.uid() or is_company_member(company_id));

create policy "company_members_owner_manage" on company_members for all
  using (is_company_owner(company_id))
  with check (is_company_owner(company_id));

create policy "platform_admins_select_admins_only" on platform_admins for select
  using (is_platform_admin());

-- =========================================================================
-- RLS: companies (reemplaza las políticas de la Fase 1)
-- =========================================================================
create policy "companies_select_member" on companies for select
  using (is_company_member(id));

create policy "companies_update_owner" on companies for update
  using (is_company_owner(id));

-- El insert lo hace normalmente create_company_with_owner (SECURITY DEFINER),
-- pero se deja esta política para cualquier otro flujo autenticado futuro.
create policy "companies_insert_authenticated" on companies for insert
  with check (auth.uid() is not null);

create policy "subscriptions_select_member" on subscriptions for select
  using (is_company_member(company_id));

-- =========================================================================
-- RLS: tablas de negocio de la Fase 1 — recrear sobre is_company_member()
-- =========================================================================
create policy "customers_all_own_company" on customers for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "customer_addresses_all_own_company" on customer_addresses for all
  using (exists (select 1 from customers c where c.id = customer_id and is_company_member(c.company_id)))
  with check (exists (select 1 from customers c where c.id = customer_id and is_company_member(c.company_id)));

create policy "product_categories_all_own_company" on product_categories for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "products_all_own_company" on products for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "service_categories_all_own_company" on service_categories for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "services_all_own_company" on services for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "sales_all_own_company" on sales for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "sale_items_all_own_company" on sale_items for all
  using (exists (select 1 from sales s where s.id = sale_id and is_company_member(s.company_id)))
  with check (exists (select 1 from sales s where s.id = sale_id and is_company_member(s.company_id)));

create policy "orders_all_own_company" on orders for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "order_items_all_own_company" on order_items for all
  using (exists (select 1 from orders o where o.id = order_id and is_company_member(o.company_id)))
  with check (exists (select 1 from orders o where o.id = order_id and is_company_member(o.company_id)));

create policy "delivery_orders_all_own_company" on delivery_orders for all
  using (exists (select 1 from orders o where o.id = order_id and is_company_member(o.company_id)))
  with check (exists (select 1 from orders o where o.id = order_id and is_company_member(o.company_id)));

create policy "payments_all_own_company" on payments for all
  using (
    exists (select 1 from orders o where o.id = order_id and is_company_member(o.company_id))
    or exists (select 1 from sales s where s.id = sale_id and is_company_member(s.company_id))
  );

create policy "expense_categories_all_own_company" on expense_categories for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "expenses_all_own_company" on expenses for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "inventory_all_own_company" on inventory for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "inventory_movements_all_own_company" on inventory_movements for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "cash_registers_all_own_company" on cash_registers for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "cash_movements_all_own_company" on cash_movements for all
  using (exists (select 1 from cash_registers cr where cr.id = cash_register_id and is_company_member(cr.company_id)))
  with check (exists (select 1 from cash_registers cr where cr.id = cash_register_id and is_company_member(cr.company_id)));
