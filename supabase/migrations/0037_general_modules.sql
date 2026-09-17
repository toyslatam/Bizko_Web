-- Features para los módulos verticales que hasta ahora no tenían clave propia.
--
-- Los items de navegación de cada vertical no estaban gateados (ver
-- VerticalNavItem en src/modules/registry.ts): se mostraban siempre porque el
-- rubro ya definía cuáles existían. El rubro "general" no puede funcionar así
-- —tiene todos los módulos— por lo que cada pantalla necesita una feature que
-- el dueño pueda prender o apagar.
insert into features (key, name, description) values
  ('pets', 'Mascotas', 'Ficha de mascotas y su historial.'),
  ('laundry_orders', 'Órdenes de lavado', 'Órdenes de lavandería con estados de prenda.'),
  ('food_service', 'Mesas y cocina', 'Pedidos en local, mesas y pantalla de cocina.'),
  ('gallery', 'Galería de trabajos', 'Galería de fotos de trabajos realizados.')
on conflict (key) do nothing;

-- Disponibles en todos los planes, igual que el resto de módulos verticales
-- (ver el comentario de la sección 6 en 0013_plans.sql): el techo por plan se
-- ajusta después desde el panel de Super Admin, sin tocar código.
insert into plan_features (plan_id, feature_key, enabled)
select p.id, f.key, true
from plans p
cross join features f
where f.key in ('pets', 'laundry_orders', 'food_service', 'gallery')
on conflict (plan_id, feature_key) do nothing;
