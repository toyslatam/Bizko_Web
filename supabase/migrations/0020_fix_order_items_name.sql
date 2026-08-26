-- =============================================================================
-- Corrige un bug real: order_items todavía tenía la columna original `name`
-- (not null, de la Fase 1) además de `product_name` (agregada en la Fase 7 al
-- evolucionar el modelo de pedidos). Cada INSERT desde entonces
-- (create_public_order, etc.) solo escribe `product_name`, así que `name`
-- se quedaba en null y violaba el "not null" — create_public_order fallaba
-- con "null value in column name of relation order_items violates not-null
-- constraint" en cuanto un cliente confirmaba un pedido real. `product_name`
-- es la columna vigente en todo el código actual (types/database.ts,
-- create_public_order, list_public_order_items) — `name` quedó huérfana.
-- =============================================================================

alter table order_items drop column if exists name;
