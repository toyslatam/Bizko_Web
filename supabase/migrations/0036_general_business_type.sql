-- Rubro "Varios": un negocio que no encaja en un vertical concreto, o que
-- mezcla varios (ej. una tienda que además presta servicios y atiende con
-- cita). Tiene disponibles todos los módulos y el dueño elige cuáles usa
-- desde Configuración — ver GENERAL_MODE en src/lib/features.ts.
--
-- Va solo en su propia migración a propósito: Postgres no permite usar un
-- valor de enum recién agregado dentro de la misma transacción, así que el
-- seed de features va aparte en 0037.
alter type business_type add value if not exists 'general';
