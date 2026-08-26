-- =============================================================================
-- FASE 10 — Reportes y analítica
-- Funciones de agregación reutilizables para todos los reportes. Todas usan
-- security invoker (respetan RLS de cada tabla) y además validan
-- is_company_member(p_company_id) como defensa adicional, siguiendo el
-- mismo patrón de is_company_member usado en el resto del proyecto.
--
-- Convención de periodo: cada función recibe p_start/p_end como timestamptz
-- ya calculados por la app en el timezone de la empresa (session.activeCompany
-- .timezone) y convertidos a UTC — así el filtro `created_at >= p_start and
-- created_at < p_end` es siempre correcto sin importar el timezone del
-- servidor de Postgres. Las funciones que agrupan POR DÍA reciben además
-- p_timezone para convertir cada fila a la fecha local del negocio antes de
-- agrupar (evita que una venta de las 11:30pm caiga en el día UTC siguiente).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- VENTAS
-- ---------------------------------------------------------------------------
create function report_sales_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (
  total_cents bigint,
  sales_count integer,
  avg_ticket_cents bigint,
  products_qty numeric,
  services_qty numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce(sum(s.total_cents), 0)::bigint,
    count(distinct s.id)::integer,
    case when count(distinct s.id) > 0
      then round(coalesce(sum(s.total_cents), 0)::numeric / count(distinct s.id))::bigint
      else 0 end,
    coalesce(sum(si.quantity) filter (where si.item_type = 'product'), 0),
    coalesce(sum(si.quantity) filter (where si.item_type = 'service'), 0)
  from sales s
  left join sale_items si on si.sale_id = s.id
  where s.company_id = p_company_id
    and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function report_sales_summary to authenticated;

create function report_sales_by_day(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_timezone text)
returns table (day date, total_cents bigint, sales_count integer)
language sql
security invoker
stable
set search_path = public
as $$
  select (s.created_at at time zone p_timezone)::date as day,
    sum(s.total_cents)::bigint,
    count(*)::integer
  from sales s
  where s.company_id = p_company_id
    and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by 1
  order by 1;
$$;
grant execute on function report_sales_by_day to authenticated;

create function report_top_products(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 10)
returns table (product_id uuid, name text, unit product_unit, quantity numeric, total_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select si.product_id, si.name, coalesce(p.unit, 'unidad'::product_unit),
    sum(si.quantity), sum(si.total_cents)::bigint
  from sale_items si
  join sales s on s.id = si.sale_id
  left join products p on p.id = si.product_id
  where s.company_id = p_company_id
    and s.status = 'completed'
    and si.item_type = 'product'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by si.product_id, si.name, p.unit
  order by sum(si.total_cents) desc
  limit p_limit;
$$;
grant execute on function report_top_products to authenticated;

create function report_top_services(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 10)
returns table (service_id uuid, name text, quantity numeric, total_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select si.service_id, si.name, sum(si.quantity), sum(si.total_cents)::bigint
  from sale_items si
  join sales s on s.id = si.sale_id
  where s.company_id = p_company_id
    and s.status = 'completed'
    and si.item_type = 'service'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by si.service_id, si.name
  order by sum(si.total_cents) desc
  limit p_limit;
$$;
grant execute on function report_top_services to authenticated;

-- ---------------------------------------------------------------------------
-- MÉTODOS DE PAGO (dinero efectivamente cobrado, no valor de pedido) — se
-- basa en cash_movements porque solo ahí se registra dinero que de verdad
-- entró (una venta/pedido contra entrega sin pagar todavía no genera
-- movimiento de caja, ver create_sale() y set_delivery_status()).
-- ---------------------------------------------------------------------------
create function report_payment_methods(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (payment_method payment_method, total_cents bigint, movement_count integer)
language sql
security invoker
stable
set search_path = public
as $$
  select cm.payment_method, sum(cm.amount_cents)::bigint, count(*)::integer
  from cash_movements cm
  where cm.company_id = p_company_id
    and cm.movement_type = 'income'
    and cm.created_at >= p_start and cm.created_at < p_end
    and is_company_member(p_company_id)
  group by cm.payment_method
  order by sum(cm.amount_cents) desc;
$$;
grant execute on function report_payment_methods to authenticated;

-- ---------------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------------
create function report_top_customers(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 10)
returns table (
  customer_id uuid, first_name text, last_name text,
  purchases_count integer, total_cents bigint, last_purchase timestamptz
)
language sql
security invoker
stable
set search_path = public
as $$
  select c.id, c.first_name, c.last_name,
    count(s.id)::integer, coalesce(sum(s.total_cents), 0)::bigint, max(s.created_at)
  from customers c
  join sales s on s.customer_id = c.id
  where c.company_id = p_company_id
    and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by c.id, c.first_name, c.last_name
  order by sum(s.total_cents) desc
  limit p_limit;
$$;
grant execute on function report_top_customers to authenticated;

-- ---------------------------------------------------------------------------
-- INVENTARIO
-- ---------------------------------------------------------------------------
create function report_inventory_movement_top(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 10)
returns table (
  product_id uuid, name text, unit product_unit,
  in_qty numeric, out_qty numeric, adjustment_qty numeric, return_qty numeric, movement_count integer
)
language sql
security invoker
stable
set search_path = public
as $$
  select im.product_id, p.name, p.unit,
    coalesce(sum(abs(im.quantity)) filter (where im.movement_type = 'in'), 0),
    coalesce(sum(abs(im.quantity)) filter (where im.movement_type = 'out'), 0),
    coalesce(sum(abs(im.quantity)) filter (where im.movement_type = 'adjustment'), 0),
    coalesce(sum(abs(im.quantity)) filter (where im.movement_type = 'return'), 0),
    count(*)::integer
  from inventory_movements im
  join products p on p.id = im.product_id
  where im.company_id = p_company_id
    and im.created_at >= p_start and im.created_at < p_end
    and is_company_member(p_company_id)
  group by im.product_id, p.name, p.unit
  order by count(*) desc
  limit p_limit;
$$;
grant execute on function report_inventory_movement_top to authenticated;

-- Rotación: clasificación simple basada en salidas históricas del periodo vs
-- stock actual — no es un modelo predictivo, solo una lectura de datos reales
-- (ver Fase 10 §10).
create function report_inventory_rotation(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (
  product_id uuid, name text, unit product_unit,
  current_stock numeric, out_qty numeric, rotation text
)
language sql
security invoker
stable
set search_path = public
as $$
  select p.id, p.name, p.unit, p.current_stock,
    coalesce(m.out_qty, 0),
    case
      when coalesce(m.out_qty, 0) = 0 then 'sin_movimiento'
      when coalesce(m.out_qty, 0) >= greatest(p.current_stock, 1) then 'alta'
      else 'baja'
    end
  from products p
  left join (
    select im.product_id, sum(abs(im.quantity)) as out_qty
    from inventory_movements im
    where im.company_id = p_company_id
      and im.movement_type = 'out'
      and im.created_at >= p_start and im.created_at < p_end
    group by im.product_id
  ) m on m.product_id = p.id
  where p.company_id = p_company_id
    and p.track_inventory = true
    and p.status = 'active'
    and is_company_member(p_company_id)
  order by coalesce(m.out_qty, 0) desc;
$$;
grant execute on function report_inventory_rotation to authenticated;

-- ---------------------------------------------------------------------------
-- GASTOS
-- ---------------------------------------------------------------------------
create function report_expenses_by_category(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (category_id uuid, category_name text, total_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select e.category_id, coalesce(ec.name, 'Sin categoría'), sum(e.amount_cents)::bigint
  from expenses e
  left join expense_categories ec on ec.id = e.category_id
  where e.company_id = p_company_id
    and e.status = 'registered'
    and e.spent_at >= p_start and e.spent_at < p_end
    and is_company_member(p_company_id)
  group by e.category_id, ec.name
  order by sum(e.amount_cents) desc;
$$;
grant execute on function report_expenses_by_category to authenticated;

create function report_expenses_by_day(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_timezone text)
returns table (day date, total_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select (e.spent_at at time zone p_timezone)::date as day, sum(e.amount_cents)::bigint
  from expenses e
  where e.company_id = p_company_id
    and e.status = 'registered'
    and e.spent_at >= p_start and e.spent_at < p_end
    and is_company_member(p_company_id)
  group by 1
  order by 1;
$$;
grant execute on function report_expenses_by_day to authenticated;

-- ---------------------------------------------------------------------------
-- RESULTADO OPERATIVO APROXIMADO (no es utilidad neta contable, ver §13)
-- ---------------------------------------------------------------------------
create function report_operating_result(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (sales_total_cents bigint, expenses_total_cents bigint, operating_result_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce((select sum(s.total_cents) from sales s
      where s.company_id = p_company_id and s.status = 'completed'
        and s.created_at >= p_start and s.created_at < p_end), 0)::bigint,
    coalesce((select sum(e.amount_cents) from expenses e
      where e.company_id = p_company_id and e.status = 'registered'
        and e.spent_at >= p_start and e.spent_at < p_end), 0)::bigint,
    (coalesce((select sum(s.total_cents) from sales s
      where s.company_id = p_company_id and s.status = 'completed'
        and s.created_at >= p_start and s.created_at < p_end), 0)
     - coalesce((select sum(e.amount_cents) from expenses e
      where e.company_id = p_company_id and e.status = 'registered'
        and e.spent_at >= p_start and e.spent_at < p_end), 0))::bigint
  where is_company_member(p_company_id);
$$;
grant execute on function report_operating_result to authenticated;

-- ---------------------------------------------------------------------------
-- PEDIDOS Y DELIVERY
-- ---------------------------------------------------------------------------
create function report_orders_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (
  received integer, confirmed integer, canceled integer, delivered integer, pending integer,
  total_value_cents bigint, pickup_count integer, delivery_count integer, cod_count integer
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    count(*)::integer,
    count(*) filter (where status not in ('pending', 'canceled'))::integer,
    count(*) filter (where status = 'canceled')::integer,
    count(*) filter (where status = 'delivered')::integer,
    count(*) filter (where status = 'pending')::integer,
    coalesce(sum(total_cents), 0)::bigint,
    count(*) filter (where fulfillment = 'pickup')::integer,
    count(*) filter (where fulfillment = 'delivery')::integer,
    count(*) filter (where payment_method = 'cash_on_delivery')::integer
  from orders
  where company_id = p_company_id
    and created_at >= p_start and created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function report_orders_summary to authenticated;

create function report_delivery_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (
  delivered integer, failed integer, delivery_fee_total_cents bigint, cod_orders integer
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    count(*) filter (where delivery_status = 'delivered')::integer,
    count(*) filter (where delivery_status = 'failed')::integer,
    coalesce(sum(delivery_fee_cents), 0)::bigint,
    count(*) filter (where payment_method = 'cash_on_delivery')::integer
  from orders
  where company_id = p_company_id
    and fulfillment = 'delivery'
    and created_at >= p_start and created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function report_delivery_summary to authenticated;

create function report_delivery_by_zone(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (zone_id uuid, zone_name text, orders_count integer, total_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select o.delivery_zone_id, coalesce(z.name, 'Sin zona'), count(*)::integer, coalesce(sum(o.total_cents), 0)::bigint
  from orders o
  left join delivery_zones z on z.id = o.delivery_zone_id
  where o.company_id = p_company_id
    and o.fulfillment = 'delivery'
    and o.created_at >= p_start and o.created_at < p_end
    and is_company_member(p_company_id)
  group by o.delivery_zone_id, z.name
  order by count(*) desc;
$$;
grant execute on function report_delivery_by_zone to authenticated;

-- ---------------------------------------------------------------------------
-- BOUTIQUE: ventas por atributo de variante (tallas, colores, ...)
-- ---------------------------------------------------------------------------
create function report_variant_attribute_sales(
  p_company_id uuid, p_start timestamptz, p_end timestamptz, p_attribute_name text
)
returns table (attribute_value text, quantity numeric, total_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select va.attribute_value, sum(si.quantity), sum(si.total_cents)::bigint
  from sale_items si
  join sales s on s.id = si.sale_id
  join variant_attributes va on va.variant_id = si.variant_id
  where s.company_id = p_company_id
    and s.status = 'completed'
    and va.attribute_name = p_attribute_name
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by va.attribute_value
  order by sum(si.total_cents) desc;
$$;
grant execute on function report_variant_attribute_sales to authenticated;
