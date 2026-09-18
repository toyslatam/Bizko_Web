-- Profesionales pasa a ser un módulo que se puede apagar.
--
-- Aparecía siempre en peluquería, mascotas, taller y lavadero por el solo
-- hecho del rubro. Pero un negocio de una sola persona —o uno que atiende con
-- cita sin repartir el trabajo entre varios— no lo necesita, y hasta ahora no
-- tenía forma de sacarlo del menú.
--
-- Apagarlo no rompe la Agenda: appointments.professional_id es nullable y el
-- formulario de cita ya ofrece "sin profesional".
insert into features (key, name, description) values
  ('professionals', 'Profesionales', 'Equipo que atiende, con servicios y comisiones.')
on conflict (key) do nothing;

insert into plan_features (plan_id, feature_key, enabled)
select p.id, f.key, true
from plans p
cross join features f
where f.key = 'professionals'
on conflict (plan_id, feature_key) do nothing;
