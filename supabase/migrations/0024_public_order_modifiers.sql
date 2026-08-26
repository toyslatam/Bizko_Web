-- =============================================================================
-- FASE — Vertical de restaurantes: modificadores en el menú público
--
-- 0023 dejó create_dine_in_order() (mesero autenticado) sabiendo calcular el
-- precio de un producto + sus modificadores elegidos, pero create_public_order()
-- (checkout anónimo del catálogo/menú online) no fue tocada — un cliente que
-- eligiera modificadores en el menú público pagaba solo el precio base y el
-- pedido llegaba a cocina sin esa información. Esta migración cierra ese hueco
-- replicando exactamente la misma lógica de precio de create_dine_in_order()
-- dentro de create_public_order(), sin cambiar su firma (p_items ya es jsonb
-- de forma libre, así que agregar `modifiers`/`notes` por línea es compatible
-- hacia atrás con cualquier cliente que todavía no los envíe).
-- =============================================================================

create or replace function create_public_order(
  p_company_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_type order_fulfillment,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_neighborhood text,
  p_delivery_reference text,
  p_delivery_area_id uuid,
  p_recipient_name text,
  p_recipient_phone text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
  v_seq integer;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal integer := 0;
  v_item jsonb;
  v_mod jsonb;
  v_product products;
  v_variant product_variants;
  v_variant_id uuid;
  v_quantity numeric;
  v_zone delivery_zones;
  v_delivery_fee integer := 0;
  v_delivery_status delivery_status_type := 'not_applicable';
  v_max_orders_month integer;
  v_orders_this_month integer;
  v_previous_stock numeric;
  v_new_stock numeric;
  v_line_price integer;
  v_line_modifiers jsonb;
  v_line_notes text;
  v_mod_option modifier_options;
begin
  select * into v_company from companies where slug = p_company_slug;
  if v_company.id is null then
    raise exception 'Negocio no encontrado.';
  end if;

  select pl.limit_value into v_max_orders_month
    from subscriptions s
    join plan_limits pl on pl.plan_id = s.plan_id and pl.limit_key = 'max_orders_month'
    where s.company_id = v_company.id;

  if v_max_orders_month is not null then
    select count(*) into v_orders_this_month from orders
      where company_id = v_company.id and created_at >= date_trunc('month', now());
    if v_orders_this_month >= v_max_orders_month then
      raise exception 'Este negocio alcanzó su límite de pedidos de este mes. Intenta contactarlo directamente.';
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu pedido debe tener al menos un producto.';
  end if;
  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if p_customer_phone is null or trim(p_customer_phone) = '' then
    raise exception 'El teléfono es obligatorio.';
  end if;

  if p_delivery_type = 'delivery' then
    if not v_company.delivery_enabled then
      raise exception 'Este negocio no tiene entrega a domicilio disponible.';
    end if;
    if p_delivery_address is null or trim(p_delivery_address) = '' then
      raise exception 'La dirección es obligatoria para domicilio.';
    end if;
    if p_delivery_area_id is not null then
      select z.* into v_zone
        from delivery_zones z
        join delivery_areas a on a.delivery_zone_id = z.id
        where a.id = p_delivery_area_id and z.company_id = v_company.id and z.is_active = true;
      if v_zone.id is null then
        raise exception 'Esa zona de entrega ya no está disponible.';
      end if;
      v_delivery_fee := v_zone.delivery_fee_cents;
    end if;
    v_delivery_status := 'pending_assignment';
  else
    if not v_company.pickup_enabled then
      raise exception 'Este negocio no tiene recoger en tienda disponible.';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = nullif(v_item ->> 'product_id', '')::uuid
        and company_id = v_company.id
        and status = 'active'
        and is_published = true
      for update;

    if v_product.id is null then
      raise exception 'Uno de los productos ya no está disponible.';
    end if;

    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida para %.', v_product.name;
    end if;

    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    if v_product.has_variants then
      if v_variant_id is null then
        raise exception '% requiere seleccionar una variante.', v_product.name;
      end if;
      select * into v_variant from product_variants
        where id = v_variant_id and product_id = v_product.id and status = 'active'
        for update;
      if v_variant.id is null then
        raise exception 'Esa variante ya no está disponible.';
      end if;
      if v_quantity > v_variant.stock then
        raise exception 'Solo quedan % disponibles de %.', v_variant.stock, v_product.name;
      end if;
      v_subtotal := v_subtotal + round(v_variant.price_cents * v_quantity)::integer;
    else
      if v_product.track_inventory and v_quantity > v_product.current_stock then
        raise exception 'Solo quedan % % disponibles de %.', v_product.current_stock, v_product.unit, v_product.name;
      end if;

      -- Modificadores (Fase Restaurantes §4): el precio de la línea nunca se
      -- confía del cliente, se recalcula acá igual que en create_dine_in_order().
      v_line_price := v_product.price_cents;
      for v_mod in select * from jsonb_array_elements(coalesce(v_item -> 'modifiers', '[]'::jsonb)) loop
        select * into v_mod_option from modifier_options where id = nullif(v_mod ->> 'option_id', '')::uuid;
        if v_mod_option.id is not null then
          v_line_price := v_line_price + v_mod_option.price_cents;
        end if;
      end loop;

      v_subtotal := v_subtotal + round(v_line_price * v_quantity)::integer;
    end if;
  end loop;

  if v_zone.id is not null and v_subtotal < v_zone.minimum_order_cents then
    raise exception 'El pedido mínimo para esta zona es de %.', to_char(v_zone.minimum_order_cents / 100.0, 'FM999G999G999D00');
  end if;

  select id into v_customer_id from customers
    where company_id = v_company.id and phone = trim(p_customer_phone)
    limit 1;

  if v_customer_id is null then
    insert into customers (company_id, first_name, phone, email, address, city)
    values (
      v_company.id, trim(p_customer_name), trim(p_customer_phone),
      nullif(trim(p_customer_email), ''), p_delivery_address, p_delivery_city
    )
    returning id into v_customer_id;
  end if;

  update companies set orders_sequence = orders_sequence + 1
    where id = v_company.id
    returning orders_sequence into v_seq;

  v_order_number := 'P-' || lpad(v_seq::text, 6, '0');

  insert into orders (
    company_id, customer_id, order_number, customer_name, customer_phone, customer_email,
    fulfillment, delivery_address, delivery_city, delivery_neighborhood, delivery_reference,
    delivery_zone_id, recipient_name, recipient_phone, estimated_delivery_time, delivery_status,
    payment_method, payment_status, subtotal_cents, delivery_fee_cents, discount_cents, total_cents,
    notes, status
  ) values (
    v_company.id, v_customer_id, v_order_number,
    trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''),
    p_delivery_type, p_delivery_address, p_delivery_city, nullif(trim(p_delivery_neighborhood), ''),
    nullif(trim(p_delivery_reference), ''),
    v_zone.id,
    coalesce(nullif(trim(p_recipient_name), ''), trim(p_customer_name)),
    coalesce(nullif(trim(p_recipient_phone), ''), trim(p_customer_phone)),
    v_zone.estimated_time, v_delivery_status,
    'cash_on_delivery', 'pending', v_subtotal, v_delivery_fee, 0, v_subtotal + v_delivery_fee,
    nullif(trim(p_notes), ''), 'pending'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;

    if v_variant_id is not null then
      select * into v_variant from product_variants where id = v_variant_id;
      insert into order_items (order_id, product_id, variant_id, product_name, quantity, unit, unit_price_cents, total_cents)
      select
        v_order_id, v_product.id, v_variant.id,
        v_product.name || coalesce(
          ' (' || (select string_agg(attribute_value, ', ' order by attribute_name) from variant_attributes where variant_id = v_variant.id) || ')',
          ''
        ),
        v_quantity, v_product.unit,
        v_variant.price_cents, round(v_variant.price_cents * v_quantity)::integer;
      update product_variants set stock = stock - v_quantity, updated_at = now() where id = v_variant_id;
    else
      v_line_price := v_product.price_cents;
      v_line_modifiers := '[]'::jsonb;
      v_line_notes := nullif(trim(v_item ->> 'notes'), '');

      for v_mod in select * from jsonb_array_elements(coalesce(v_item -> 'modifiers', '[]'::jsonb)) loop
        select * into v_mod_option from modifier_options where id = nullif(v_mod ->> 'option_id', '')::uuid;
        if v_mod_option.id is not null then
          v_line_price := v_line_price + v_mod_option.price_cents;
          v_line_modifiers := v_line_modifiers || jsonb_build_object('name', v_mod_option.name, 'price_cents', v_mod_option.price_cents);
        end if;
      end loop;

      insert into order_items (
        order_id, product_id, product_name, quantity, unit, unit_price_cents, total_cents, modifiers, notes
      ) values (
        v_order_id, v_product.id, v_product.name, v_quantity, v_product.unit,
        v_line_price, round(v_line_price * v_quantity)::integer, v_line_modifiers, v_line_notes
      );

      if v_product.track_inventory then
        v_previous_stock := v_product.current_stock;
        v_new_stock := greatest(v_previous_stock - v_quantity, 0);

        update products set current_stock = v_new_stock, updated_at = now() where id = v_product.id;

        insert into inventory_movements (
          company_id, product_id, movement_type, quantity, previous_stock, new_stock,
          reason, reference_type, reference_id
        ) values (
          v_company.id, v_product.id, 'out', -v_quantity, v_previous_stock, v_new_stock,
          'Pedido ' || v_order_number, 'order', v_order_id
        );
      end if;
    end if;
  end loop;

  return v_order_id;
end;
$$;
grant execute on function create_public_order to anon, authenticated;
