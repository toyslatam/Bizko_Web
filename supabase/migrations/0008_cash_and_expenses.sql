-- bizko — Fase 6: caja, ingresos, gastos y movimientos de dinero
--
-- cash_registers/cash_movements/expenses/expense_categories ya existían
-- desde 0001_init.sql con columnas mínimas; se completan aquí. El dinero
-- nunca se escribe directo: siempre pasa por create_cash_movement(), igual
-- que el inventario pasa siempre por apply_inventory_movement().

create type cash_register_status as enum ('open', 'closed');
create type cash_movement_type as enum ('income', 'expense', 'adjustment');
create type expense_status as enum ('registered', 'voided');

-- =========================================================================
-- cash_registers
-- =========================================================================
alter table cash_registers
  add column if not exists status cash_register_status not null default 'open',
  add column if not exists opening_notes text,
  add column if not exists closing_notes text,
  add column if not exists expected_amount_cents integer,
  add column if not exists difference_cents integer,
  add column if not exists closed_by uuid references auth.users (id);
alter table cash_registers rename column closing_amount_cents to counted_amount_cents;

-- Igual que sales.user_id / inventory_movements.user_id: FK extra hacia
-- profiles(id) para poder embeber el nombre de quien abrió/cerró la caja.
alter table cash_registers
  add constraint cash_registers_opened_by_profiles_fkey
  foreign key (opened_by) references profiles (id);
alter table cash_registers
  add constraint cash_registers_closed_by_profiles_fkey
  foreign key (closed_by) references profiles (id);

-- Solo puede existir una caja abierta a la vez por empresa.
create unique index cash_registers_one_open_per_company_idx
  on cash_registers (company_id)
  where status = 'open';

create index cash_registers_company_status_idx on cash_registers (company_id, status);

-- =========================================================================
-- cash_movements
-- =========================================================================
alter table cash_movements
  add column if not exists company_id uuid references companies (id) on delete cascade,
  add column if not exists user_id uuid references auth.users (id),
  add column if not exists payment_method payment_method,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists description text;

update cash_movements cm
  set company_id = cr.company_id
  from cash_registers cr
  where cm.cash_register_id = cr.id and cm.company_id is null;
alter table cash_movements alter column company_id set not null;

update cash_movements set description = reason where description is null;
alter table cash_movements drop column reason;
alter table cash_movements drop column type;
alter table cash_movements add column movement_type cash_movement_type;
update cash_movements
  set movement_type = (case when amount_cents >= 0 then 'income' else 'expense' end)::cash_movement_type
  where movement_type is null;
alter table cash_movements alter column movement_type set not null;

alter table cash_movements
  add constraint cash_movements_user_id_profiles_fkey
  foreign key (user_id) references profiles (id);

create index cash_movements_company_id_idx on cash_movements (company_id, created_at desc);

-- =========================================================================
-- expenses / expense_categories
-- =========================================================================
alter table expense_categories
  add column if not exists description text,
  add column if not exists status entity_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

alter table expenses
  add column if not exists user_id uuid references auth.users (id),
  add column if not exists payment_method payment_method not null default 'cash',
  add column if not exists status expense_status not null default 'registered',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table expenses
  add constraint expenses_user_id_profiles_fkey
  foreign key (user_id) references profiles (id);

create index expenses_company_status_idx on expenses (company_id, status);

-- =========================================================================
-- RPC: única vía para crear un movimiento de caja.
-- =========================================================================
create function create_cash_movement(
  p_company_id uuid,
  p_cash_register_id uuid,
  p_movement_type cash_movement_type,
  p_amount_cents integer,
  p_payment_method payment_method,
  p_reference_type text,
  p_reference_id uuid,
  p_description text
)
returns cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_register cash_registers;
  v_signed_amount integer;
  v_movement cash_movements;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select * into v_register from cash_registers
    where id = p_cash_register_id and company_id = p_company_id;
  if v_register.id is null then
    raise exception 'Caja no encontrada.';
  end if;
  if v_register.status != 'open' then
    raise exception 'La caja está cerrada.';
  end if;

  v_signed_amount := case p_movement_type
    when 'expense' then -abs(p_amount_cents)
    when 'income' then abs(p_amount_cents)
    else p_amount_cents -- adjustment: ya viene firmado (+/-)
  end;

  insert into cash_movements (
    company_id, cash_register_id, user_id, movement_type, amount_cents,
    payment_method, reference_type, reference_id, description
  ) values (
    p_company_id, p_cash_register_id, auth.uid(), p_movement_type, v_signed_amount,
    p_payment_method, p_reference_type, p_reference_id, nullif(trim(p_description), '')
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

grant execute on function create_cash_movement to authenticated;

-- =========================================================================
-- RPC: abrir caja
-- =========================================================================
create function open_cash_register(
  p_company_id uuid,
  p_opening_amount_cents integer,
  p_notes text
)
returns cash_registers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_register cash_registers;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  if exists (select 1 from cash_registers where company_id = p_company_id and status = 'open') then
    raise exception 'Ya tienes una caja abierta.';
  end if;
  if p_opening_amount_cents is null or p_opening_amount_cents < 0 then
    raise exception 'El monto inicial debe ser mayor o igual a 0.';
  end if;

  insert into cash_registers (company_id, opened_by, opening_amount_cents, opening_notes, status)
  values (p_company_id, auth.uid(), p_opening_amount_cents, nullif(trim(p_notes), ''), 'open')
  returning * into v_register;

  return v_register;
end;
$$;

grant execute on function open_cash_register to authenticated;

-- =========================================================================
-- RPC: cerrar caja. Registra la diferencia (si la hay) como un movimiento
-- de ajuste ANTES de cerrar, para que el historial quede autoexplicado.
-- =========================================================================
create function close_cash_register(
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

  return v_register;
end;
$$;

grant execute on function close_cash_register to authenticated;

-- =========================================================================
-- RPC: gastos. create_expense genera automáticamente su egreso de caja
-- (si hay una caja abierta); void_expense genera el ingreso inverso.
-- =========================================================================
create function create_expense(
  p_company_id uuid,
  p_category_id uuid,
  p_description text,
  p_amount_cents integer,
  p_payment_method payment_method,
  p_date date,
  p_notes text
)
returns expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense expenses;
  v_open_register_id uuid;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  if p_description is null or trim(p_description) = '' then
    raise exception 'La descripción es obligatoria.';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'El monto debe ser mayor a 0.';
  end if;

  insert into expenses (
    company_id, user_id, category_id, description, amount_cents,
    payment_method, spent_at, notes, status
  ) values (
    p_company_id, auth.uid(), p_category_id, trim(p_description), p_amount_cents,
    p_payment_method, coalesce(p_date, current_date), nullif(trim(p_notes), ''), 'registered'
  )
  returning * into v_expense;

  select id into v_open_register_id from cash_registers
    where company_id = p_company_id and status = 'open';

  if v_open_register_id is not null then
    perform create_cash_movement(
      p_company_id, v_open_register_id, 'expense', p_amount_cents, p_payment_method,
      'expense', v_expense.id, trim(p_description)
    );
  end if;

  return v_expense;
end;
$$;

grant execute on function create_expense to authenticated;

create function void_expense(p_expense_id uuid)
returns expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense expenses;
  v_movement cash_movements;
  v_is_owner_or_manager boolean;
begin
  select * into v_expense from expenses where id = p_expense_id;
  if v_expense.id is null then
    raise exception 'Gasto no encontrado.';
  end if;
  if v_expense.status != 'registered' then
    raise exception 'Este gasto ya está anulado.';
  end if;

  select exists (
    select 1 from company_members
    where company_id = v_expense.company_id and user_id = auth.uid()
      and role in ('owner', 'manager') and status = 'active'
  ) or is_platform_admin() into v_is_owner_or_manager;
  if not v_is_owner_or_manager then
    raise exception 'No tienes permiso para anular gastos.';
  end if;

  update expenses set status = 'voided', updated_at = now()
    where id = p_expense_id
    returning * into v_expense;

  select * into v_movement from cash_movements
    where reference_type = 'expense' and reference_id = p_expense_id and movement_type = 'expense'
    limit 1;

  if v_movement.id is not null then
    if (select status from cash_registers where id = v_movement.cash_register_id) = 'open' then
      perform create_cash_movement(
        v_expense.company_id, v_movement.cash_register_id, 'income', abs(v_movement.amount_cents),
        v_movement.payment_method, 'expense_void', v_expense.id, 'Anulación de gasto: ' || v_expense.description
      );
    end if;
  end if;

  return v_expense;
end;
$$;

grant execute on function void_expense to authenticated;

-- =========================================================================
-- create_sale(): se reemplaza para generar el ingreso de caja automático
-- (excepto contra entrega, que no cuenta como dinero recibido todavía).
-- =========================================================================
create or replace function create_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_payment_method payment_method,
  p_discount_cents integer,
  p_notes text,
  p_items jsonb
)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales;
  v_seq integer;
  v_subtotal integer := 0;
  v_item jsonb;
  v_quantity numeric;
  v_unit_price integer;
  v_item_discount integer;
  v_item_total integer;
  v_product_id uuid;
  v_track_inventory boolean;
  v_open_register_id uuid;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto o servicio.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price_cents')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a 0.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio debe ser mayor o igual a 0.';
    end if;
    v_item_discount := coalesce((v_item ->> 'discount_cents')::integer, 0);
    v_subtotal := v_subtotal + round(v_unit_price * v_quantity)::integer - v_item_discount;
  end loop;

  update companies set sales_sequence = sales_sequence + 1
    where id = p_company_id
    returning sales_sequence into v_seq;

  insert into sales (
    company_id, customer_id, user_id, sale_number,
    subtotal_cents, discount_cents, tax_cents, total_cents,
    payment_method, status, notes
  )
  values (
    p_company_id,
    p_customer_id,
    auth.uid(),
    'V-' || lpad(v_seq::text, 6, '0'),
    v_subtotal,
    coalesce(p_discount_cents, 0),
    0,
    greatest(v_subtotal - coalesce(p_discount_cents, 0), 0),
    p_payment_method,
    'completed',
    nullif(trim(p_notes), '')
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price_cents')::integer;
    v_item_discount := coalesce((v_item ->> 'discount_cents')::integer, 0);
    v_item_total := round(v_unit_price * v_quantity)::integer - v_item_discount;
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;

    insert into sale_items (
      sale_id, product_id, service_id, item_type, name, quantity,
      unit_price_cents, discount_cents, total_cents
    ) values (
      v_sale.id,
      v_product_id,
      nullif(v_item ->> 'service_id', '')::uuid,
      (v_item ->> 'item_type')::sale_item_type,
      v_item ->> 'name',
      v_quantity,
      v_unit_price,
      v_item_discount,
      v_item_total
    );

    if v_product_id is not null then
      select track_inventory into v_track_inventory from products where id = v_product_id;
      if v_track_inventory then
        perform apply_inventory_movement(
          p_company_id, v_product_id, 'out', v_quantity,
          'Venta ' || v_sale.sale_number, 'sale', v_sale.id
        );
      end if;
    end if;
  end loop;

  -- Contra entrega no cuenta como dinero recibido todavía (llegará con
  -- pedidos/delivery en una fase futura).
  if p_payment_method != 'cash_on_delivery' then
    select id into v_open_register_id from cash_registers
      where company_id = p_company_id and status = 'open';
    if v_open_register_id is not null then
      perform create_cash_movement(
        p_company_id, v_open_register_id, 'income', v_sale.total_cents, p_payment_method,
        'sale', v_sale.id, 'Venta ' || v_sale.sale_number
      );
    end if;
  end if;

  return v_sale;
end;
$$;

-- =========================================================================
-- void_sale(): se reemplaza para revertir también el ingreso de caja (si
-- la caja donde se registró sigue abierta).
-- =========================================================================
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

  return v_sale;
end;
$$;

-- =========================================================================
-- create_company_with_owner(): se reemplaza para sembrar categorías de
-- gasto por defecto en cada empresa nueva.
-- =========================================================================
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
  insert into subscriptions (company_id, plan_id, status)
  values (v_company.id, v_basic_plan_id, 'active');

  insert into profiles (id, email)
  values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (id) do nothing;

  insert into expense_categories (company_id, name)
  select v_company.id, name
  from unnest(array[
    'Alquiler', 'Servicios', 'Transporte', 'Insumos',
    'Mantenimiento', 'Personal', 'Publicidad', 'Otros'
  ]) as name;

  return v_company;
end;
$$;
