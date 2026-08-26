-- =============================================================================
-- Ajuste de precios, copy y límite de usuarios de los planes (referencial,
-- sin cobro activo todavía — ver Fase 11 §26/§17 de la Fase 11).
-- =============================================================================

update plans set
  currency = 'USD',
  price_monthly_cents = 500,
  price_yearly_cents = 5000,
  description = 'Quiero organizar mi negocio.'
where code = 'basico';

update plans set
  currency = 'USD',
  price_monthly_cents = 900,
  price_yearly_cents = 9000,
  description = 'Quiero vender más y administrar mejor.'
where code = 'negocio';

update plans set
  currency = 'USD',
  price_monthly_cents = 2000,
  price_yearly_cents = 20000,
  description = 'Quiero automatizar mi negocio.'
where code = 'pro';

update plan_limits set limit_value = 5
  where limit_key = 'max_users' and plan_id = (select id from plans where code = 'basico');
update plan_limits set limit_value = 10
  where limit_key = 'max_users' and plan_id = (select id from plans where code = 'negocio');
update plan_limits set limit_value = 15
  where limit_key = 'max_users' and plan_id = (select id from plans where code = 'pro');
