-- Movimientos de inventario para productos con variantes.
--
-- Hasta acá, apply_inventory_movement solo operaba sobre products.current_stock
-- y exigía track_inventory = true. Pero productos/actions.ts guarda siempre
-- track_inventory = false cuando el producto tiene variantes (el stock vive en
-- product_variants.stock), así que esos productos quedaban fuera del diálogo de
-- Entrada/Salida/Ajuste: no había forma de registrarles un movimiento.

alter table inventory_movements
  add column if not exists variant_id uuid references product_variants (id) on delete cascade;

create index if not exists inventory_movements_variant_id_idx
  on inventory_movements (variant_id);

-- DROP explícito: agregar un parámetro con default crearía una sobrecarga y las
-- llamadas con 7 argumentos quedarían ambiguas.
drop function if exists apply_inventory_movement(
  uuid, uuid, inventory_movement_type, numeric, text, text, uuid
);

create function apply_inventory_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_movement_type inventory_movement_type,
  p_quantity numeric,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_variant_id uuid default null
)
returns inventory_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
  v_variant product_variants;
  v_previous numeric;
  v_new numeric;
  v_signed_qty numeric;
  v_movement inventory_movements;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select * into v_product from products
    where id = p_product_id and company_id = p_company_id
    for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado.';
  end if;

  if p_quantity is null or (p_movement_type != 'adjustment' and p_quantity <= 0) then
    raise exception 'La cantidad debe ser mayor a 0.';
  end if;

  v_signed_qty := case p_movement_type
    when 'out' then -abs(p_quantity)
    when 'in' then abs(p_quantity)
    when 'return' then abs(p_quantity)
    else p_quantity -- adjustment: ya viene firmado (+/-)
  end;

  if p_variant_id is not null then
    -- El stock de un producto con variantes vive en cada variante, no en el
    -- producto padre, así que track_inventory no aplica.
    select * into v_variant from product_variants
      where id = p_variant_id
        and product_id = p_product_id
        and company_id = p_company_id
      for update;

    if v_variant.id is null then
      raise exception 'Variante no encontrada.';
    end if;

    v_previous := v_variant.stock;
    v_new := v_previous + v_signed_qty;

    if v_new < 0 then
      raise exception 'No hay suficiente inventario disponible. Stock actual: %.', v_previous;
    end if;

    update product_variants set stock = v_new, updated_at = now() where id = p_variant_id;
  else
    if not v_product.track_inventory then
      raise exception 'Este producto no tiene control de inventario activado.';
    end if;

    v_previous := v_product.current_stock;
    v_new := v_previous + v_signed_qty;

    if v_new < 0 then
      raise exception 'No hay suficiente inventario disponible. Stock actual: %.', v_previous;
    end if;

    update products set current_stock = v_new, updated_at = now() where id = p_product_id;
  end if;

  insert into inventory_movements (
    company_id, product_id, variant_id, movement_type, quantity, previous_stock, new_stock,
    reason, reference_type, reference_id, user_id
  ) values (
    p_company_id, p_product_id, p_variant_id, p_movement_type, v_signed_qty, v_previous, v_new,
    nullif(trim(p_reason), ''), p_reference_type, p_reference_id, auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

grant execute on function apply_inventory_movement to authenticated;
