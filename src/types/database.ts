/**
 * Tipos del dominio central (CORE) de bizko.
 * Reflejan las tablas de supabase/migrations/0001_init.sql.
 * Toda entidad de negocio cuelga de `company_id` (multi-tenant).
 */

export type PlanCode = "basico" | "negocio" | "pro";

/** Rol dentro de una empresa (company_members.role). No incluye super_admin: */
/** eso vive aparte, en la tabla platform_admins (ver `PlatformAdmin`). */
export type CompanyRole = "owner" | "manager" | "employee";
export type UserRole = CompanyRole;

export type MemberStatus = "active" | "invited" | "inactive";

export type BusinessType =
  | "bakery"
  | "produce"
  | "moto_wash"
  | "barbershop"
  | "laundry"
  | "pet_shop"
  | "workshop"
  | "food"
  | "boutique";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired" | "suspended";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "canceled";

export type OrderFulfillment = "pickup" | "delivery" | "dine_in";

export type PaymentMethod = "cash_on_delivery" | "cash" | "card" | "transfer";

export interface Plan {
  id: string;
  code: PlanCode;
  slug: string;
  name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  currency: string;
  is_active: boolean;
  is_recommended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string | null;
  trial_ends_at: string | null;
  /** Preparación para un futuro proveedor de pagos (Fase 12 §28) — ninguno integrado todavía. */
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  billing_cycle: string;
  next_billing_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Auditoría de acciones del Super Admin (Fase 12 §19). */
export interface AdminAuditLog {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  company_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Clave de feature del catálogo (ver `features`/`plan_features`) — Fase 11 §6. */
export type FeatureKey =
  | "dashboard"
  | "customers"
  | "products"
  | "services"
  | "sales"
  | "inventory"
  | "cash"
  | "catalog"
  | "orders"
  | "delivery"
  | "reports"
  | "advanced_reports"
  | "variants"
  | "appointments"
  | "work_orders"
  | "recipes"
  | "ai"
  | "automation"
  | "crm"
  | "marketing";

export const ALL_FEATURE_KEYS: FeatureKey[] = [
  "dashboard",
  "customers",
  "products",
  "services",
  "sales",
  "inventory",
  "cash",
  "catalog",
  "orders",
  "delivery",
  "reports",
  "advanced_reports",
  "variants",
  "appointments",
  "work_orders",
  "recipes",
  "ai",
  "automation",
  "crm",
  "marketing",
];

export interface FeatureDef {
  id: string;
  key: FeatureKey;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PlanFeature {
  id: string;
  plan_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
}

/** `limit_value: null` significa "ilimitado" — ver Fase 11 §8. */
export type PlanLimitKey =
  | "max_users"
  | "max_products"
  | "max_customers"
  | "max_orders_month"
  | "max_storage_mb"
  | "max_ai_queries_month"
  | "max_automations_active"
  | "max_leads"
  | "max_marketing_credits_month";

export interface PlanLimit {
  id: string;
  plan_id: string;
  limit_key: PlanLimitKey;
  limit_value: number | null;
}

export interface PlanUsageRow {
  limit_key: PlanLimitKey;
  limit_value: number | null;
  current_usage: number;
}

// =============================================================================
// Fase 13 — IA y automatizaciones (estructura; ver docs/fase-13-ia-automatizaciones.md).
// =============================================================================

export interface AiUsage {
  id: string;
  company_id: string;
  user_id: string | null;
  query: string;
  response: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export type AutomationStatus = "active" | "paused" | "error";

export type AutomationTrigger =
  | "new_order"
  | "order_status_changed"
  | "sale_created"
  | "low_stock"
  | "customer_created"
  | "appointment_created"
  | "appointment_upcoming"
  | "expense_created"
  | "daily_schedule"
  | "weekly_schedule";

export type AutomationActionType = "notification" | "email" | "webhook" | "create_task" | "ai_summary";

export interface Automation {
  id: string;
  company_id: string;
  name: string;
  trigger_type: AutomationTrigger;
  condition: Record<string, unknown>;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  status: AutomationStatus;
  template_key: string | null;
  consecutive_errors: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AutomationExecutionStatus = "pending" | "running" | "success" | "failed";

export interface AutomationUsage {
  id: string;
  company_id: string;
  automation_id: string;
  execution_id: string | null;
  status: AutomationExecutionStatus;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  idempotency_key: string | null;
}

export type NotificationType = "low_stock" | "new_order" | "automation_executed" | "automation_error" | "ai_limit_warning";

export interface AppNotification {
  id: string;
  company_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  business_type: BusinessType;
  logo_url: string | null;
  banner_url: string | null;
  /** Color de acento del catálogo público de este negocio — nunca afecta el panel interno (Fase 15.1 §12). */
  accent_color: string | null;
  description: string | null;
  business_hours: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string;
  currency: string;
  timezone: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

/** Perfil de usuario, separado de Supabase Auth (auth.users). */
export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Relación usuario <-> empresa. Un usuario puede tener varias filas (varias empresas). */
export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  status: MemberStatus;
  created_at: string;
}

/** Administrador de la plataforma bizko (no un rol de empresa). */
export interface PlatformAdmin {
  user_id: string;
  created_at: string;
}

export type EntityStatus = "active" | "inactive";

export type ProductUnit =
  | "unidad"
  | "kg"
  | "g"
  | "libra"
  | "litro"
  | "ml"
  | "metro"
  | "servicio";

export interface Customer {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  status: EntityStatus;
  source: LeadSource | null;
  converted_from_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: EntityStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  cost_cents: number;
  unit: ProductUnit;
  sku: string | null;
  track_inventory: boolean;
  current_stock: number;
  minimum_stock: number;
  status: EntityStatus;
  is_published: boolean;
  has_variants: boolean;
  /** Solo relevante para el vertical "comida preparada". */
  prep_time_minutes: number | null;
  is_featured: boolean;
  available_from: string | null;
  available_until: string | null;
  /** Insumo (ej. carne, pan) — no aparece en el menú público, solo se controla en Inventario. */
  is_ingredient: boolean;
  /** Producto combo — incluye otros productos (ver `combo_items`). */
  is_combo: boolean;
  created_at: string;
  updated_at: string;
}

/** Foto adicional de un producto (además de `products.image_url`) — para la galería/carrusel del detalle. */
export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface PublicProductImage {
  id: string;
  image_url: string;
  sort_order: number;
}

/** Variante de un producto (boutique: talla/color/etc). Stock independiente del producto. */
// =============================================================================
// Vertical de restaurantes y comida rápida — modificadores, combos, mesas.
// =============================================================================

export type ModifierSelectionType = "single" | "multiple";

export interface ModifierGroup {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  selection_type: ModifierSelectionType;
  is_required: boolean;
  min_selections: number;
  /** `null` = sin límite. */
  max_selections: number | null;
  sort_order: number;
  created_at: string;
}

export interface ModifierOption {
  id: string;
  modifier_group_id: string;
  name: string;
  price_cents: number;
  sort_order: number;
}

/** Fila de list_public_modifier_groups() — el menú público. */
export interface PublicModifierGroup {
  id: string;
  name: string;
  selection_type: ModifierSelectionType;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
}

/** Fila de list_public_modifier_options(). */
export interface PublicModifierOption {
  id: string;
  modifier_group_id: string;
  name: string;
  price_cents: number;
  sort_order: number;
}

export interface ComboItem {
  id: string;
  combo_product_id: string;
  component_product_id: string;
  quantity: number;
  sort_order: number;
}

/** Fila de list_public_combo_items(). */
export interface PublicComboItem {
  component_name: string;
  quantity: number;
  unit: ProductUnit;
}

export type TableStatus = "available" | "occupied" | "reserved" | "attending";

export interface RestaurantTable {
  id: string;
  company_id: string;
  name: string;
  capacity: number | null;
  status: TableStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  company_id: string;
  product_id: string;
  sku: string | null;
  price_cents: number;
  cost_cents: number;
  stock: number;
  image_url: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

/** Atributo libre de una variante (ej. {attribute_name:"Talla", attribute_value:"M"}). */
export interface VariantAttribute {
  id: string;
  variant_id: string;
  attribute_name: string;
  attribute_value: string;
}

export interface PublicVariant {
  id: string;
  sku: string | null;
  price_cents: number;
  stock: number;
  image_url: string | null;
}

export interface PublicVariantAttribute {
  variant_id: string;
  attribute_name: string;
  attribute_value: string;
}

export interface ServiceCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: EntityStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  duration_minutes: number | null;
  status: EntityStatus;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type SaleStatus = "completed" | "voided";
/** De dónde vino la venta — `catalog` la genera automáticamente un pedido entregado y pagado. */
export type SaleSource = "pos" | "menu" | "delivery" | "table" | "takeout";
export type SaleItemType = "product" | "service";

export interface Sale {
  id: string;
  company_id: string;
  customer_id: string | null;
  user_id: string;
  sale_number: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  notes: string | null;
  /** Evita duplicar la venta si un reintento de red repite la misma solicitud (Fase 14 §10). */
  idempotency_key: string | null;
  source: SaleSource;
  /** Pedido de origen si `source` es "catalog" — trazabilidad PEDIDO → VENTA. */
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  service_id: string | null;
  variant_id: string | null;
  item_type: SaleItemType;
  name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
  modifiers: { name: string; price_cents: number }[];
  notes: string | null;
}

export interface CustomerAddress {
  id: string;
  company_id: string;
  customer_id: string;
  label: string;
  address: string;
  city: string | null;
  neighborhood: string | null;
  reference: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderPaymentStatus = "pending" | "paid" | "canceled";

export type DeliveryDriverStatus = "available" | "busy" | "inactive";

export type DeliveryStatus =
  | "not_applicable"
  | "pending_assignment"
  | "assigned"
  | "picked_up"
  | "on_the_way"
  | "delivered"
  | "failed";

export interface DeliveryZone {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  delivery_fee_cents: number;
  minimum_order_cents: number;
  estimated_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryArea {
  id: string;
  company_id: string;
  delivery_zone_id: string;
  name: string;
  created_at: string;
}

export interface DeliveryDriver {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  status: DeliveryDriverStatus;
  created_at: string;
  updated_at: string;
}

/** Fila devuelta por list_public_delivery_areas() — segura para el checkout público. */
export interface PublicDeliveryArea {
  id: string;
  name: string;
  delivery_zone_id: string;
  zone_name: string;
  delivery_fee_cents: number;
  minimum_order_cents: number;
  estimated_time: string | null;
}

export interface Order {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  address_id: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_neighborhood: string | null;
  delivery_reference: string | null;
  delivery_zone_id: string | null;
  delivery_address_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  estimated_delivery_time: string | null;
  delivery_driver_id: string | null;
  delivery_status: DeliveryStatus;
  delivery_failure_reason: string | null;
  scheduled_delivery_date: string | null;
  scheduled_delivery_time: string | null;
  payment_method: PaymentMethod;
  payment_status: OrderPaymentStatus;
  subtotal_cents: number;
  delivery_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  notes: string | null;
  /** Mesa de origen para pedidos `dine_in` (Fase Restaurantes). */
  table_id: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  service_id: string | null;
  variant_id: string | null;
  product_name: string;
  unit: ProductUnit | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  /** Modificadores elegidos, ej. [{"name": "Queso", "price_cents": 3000}]. */
  modifiers: { name: string; price_cents: number }[];
  notes: string | null;
}

/** Fila devuelta por get_public_company() — solo columnas seguras para /store/[slug]. */
export interface PublicCompany {
  id: string;
  name: string;
  slug: string;
  business_type: BusinessType;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  business_hours: string | null;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  accent_color: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
}

/** Fila devuelta por list_public_products() — nunca incluye cost_cents. */
export interface PublicProduct {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  unit: ProductUnit;
  sku: string | null;
  track_inventory: boolean;
  current_stock: number;
  has_variants: boolean;
  is_featured: boolean;
}

/** Fila devuelta por get_public_order() — resumen de confirmación del pedido. */
export interface PublicOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  payment_method: PaymentMethod;
  payment_status: OrderPaymentStatus;
  customer_name: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_neighborhood: string | null;
  delivery_reference: string | null;
  estimated_delivery_time: string | null;
  delivery_status: DeliveryStatus;
  subtotal_cents: number;
  delivery_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  notes: string | null;
  created_at: string;
  company_name: string;
  company_slug: string;
}

export interface PublicOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit: ProductUnit | null;
  unit_price_cents: number;
  total_cents: number;
}

export interface Payment {
  id: string;
  order_id: string | null;
  sale_id: string | null;
  method: PaymentMethod;
  amount_cents: number;
  paid_at: string | null;
}

export type ExpenseStatus = "registered" | "voided";

export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  user_id: string | null;
  category_id: string | null;
  description: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  status: ExpenseStatus;
  spent_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryMovementType = "in" | "out" | "adjustment" | "return";

export interface InventoryMovement {
  id: string;
  company_id: string;
  product_id: string;
  movement_type: InventoryMovementType;
  /** Cantidad firmada ya aplicada al stock (negativa en salidas). */
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  user_id: string | null;
  created_at: string;
}

export type CashRegisterStatus = "open" | "closed";
export type CashMovementType = "income" | "expense" | "adjustment";

export interface CashRegister {
  id: string;
  company_id: string;
  opened_by: string;
  closed_by: string | null;
  status: CashRegisterStatus;
  opening_amount_cents: number;
  opening_notes: string | null;
  counted_amount_cents: number | null;
  expected_amount_cents: number | null;
  difference_cents: number | null;
  closing_notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface CashMovement {
  id: string;
  company_id: string;
  cash_register_id: string;
  user_id: string | null;
  movement_type: CashMovementType;
  /** Cantidad firmada: ingresos positivos, egresos negativos. */
  amount_cents: number;
  payment_method: PaymentMethod;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  idempotency_key: string | null;
  created_at: string;
}

/** Registro de acciones sensibles de negocio (Fase 14 §39) — visible para la propia empresa. */
export interface BusinessAuditLog {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =============================================================================
// Fase 9 — módulos específicos por tipo de negocio (CORE + VERTICAL).
// Cada vertical reutiliza customers/products/services/sales; estas tablas
// solo agregan lo propio de cada tipo de negocio.
// =============================================================================

/** Lavado de motos + Taller: vehículos del cliente. */
export interface Vehicle {
  id: string;
  company_id: string;
  customer_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "canceled" | "no_show";

/** Barbería: agenda / citas. */
export interface Appointment {
  id: string;
  company_id: string;
  customer_id: string | null;
  service_id: string | null;
  employee_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LaundryOrderStatus = "received" | "in_process" | "ready" | "delivered" | "canceled";

/** Lavandería: órdenes de lavado. */
export interface LaundryOrder {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_number: string;
  received_at: string;
  estimated_ready_at: string | null;
  delivered_at: string | null;
  status: LaundryOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaundryOrderItem {
  id: string;
  laundry_order_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
}

/** Tienda de mascotas. */
export interface Pet {
  id: string;
  company_id: string;
  customer_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkOrderStatus =
  | "received"
  | "diagnosis"
  | "in_repair"
  | "waiting_parts"
  | "ready"
  | "delivered"
  | "canceled";

/** Taller: órdenes de trabajo (reutiliza vehicles). */
export interface WorkOrder {
  id: string;
  company_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  order_number: string;
  description: string | null;
  diagnosis: string | null;
  status: WorkOrderStatus;
  estimated_total_cents: number | null;
  final_total_cents: number | null;
  created_at: string;
  updated_at: string;
}

/** Panadería: recetas de producción. */
export interface Recipe {
  id: string;
  company_id: string;
  product_id: string | null;
  name: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  quantity: number;
  unit: ProductUnit;
}

export interface ProductionOrder {
  id: string;
  company_id: string;
  recipe_id: string;
  quantity_produced: number;
  produced_at: string;
  user_id: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------
export type LeadSource =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "website"
  | "form"
  | "catalog"
  | "referral"
  | "manual";

export interface CrmPipelineStage {
  id: string;
  company_id: string;
  name: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  company_id: string;
  stage_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  source: LeadSource;
  product_interest: string | null;
  potential_value_cents: number | null;
  assigned_to: string | null;
  customer_id: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  last_interaction_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadStageHistory {
  id: string;
  lead_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_by: string | null;
  changed_at: string;
}

export interface CrmTask {
  id: string;
  company_id: string;
  lead_id: string | null;
  customer_id: string | null;
  title: string;
  due_at: string | null;
  done_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CrmNote {
  id: string;
  company_id: string;
  lead_id: string | null;
  customer_id: string | null;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface CrmTag {
  id: string;
  company_id: string;
  name: string;
  color: string;
}

export interface CrmTagLink {
  tag_id: string;
  lead_id: string | null;
  customer_id: string | null;
}

export type CrmChannelType = "whatsapp" | "instagram" | "facebook" | "linkedin" | "email" | "web";
export type CrmChannelStatus = "not_connected" | "connected";

export interface CrmChannel {
  id: string;
  company_id: string;
  channel_type: CrmChannelType;
  status: CrmChannelStatus;
  config: Record<string, unknown>;
  created_at: string;
}

export type CrmConversationStatus = "open" | "pending" | "closed";

export interface CrmConversation {
  id: string;
  company_id: string;
  channel_type: CrmChannelType;
  contact_name: string;
  contact_handle: string | null;
  lead_id: string | null;
  customer_id: string | null;
  status: CrmConversationStatus;
  assigned_to: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
}

export type CrmMessageDirection = "inbound" | "outbound";

export interface CrmMessage {
  id: string;
  conversation_id: string;
  direction: CrmMessageDirection;
  body: string;
  sender_id: string | null;
  sent_at: string;
}

export interface CustomerCrmSummary {
  leads_count: number;
  open_tasks_count: number;
  notes_count: number;
  total_purchases_cents: number;
  purchases_count: number;
  last_purchase_at: string | null;
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------
export type CampaignObjective =
  | "generate_leads"
  | "sell_product"
  | "launch_product"
  | "recover_customers"
  | "increase_ticket"
  | "promote_season"
  | "increase_visits"
  | "loyalty";

export type CampaignAudienceType =
  | "all_customers"
  | "new_customers"
  | "frequent_customers"
  | "inactive_customers"
  | "category_buyers"
  | "product_buyers"
  | "leads"
  | "custom_segment";

export type CampaignStatus = "draft" | "review" | "approved" | "scheduled" | "published" | "finished";

export interface MarketingCampaign {
  id: string;
  company_id: string;
  name: string;
  objective: CampaignObjective;
  audience_type: CampaignAudienceType;
  audience_config: Record<string, unknown>;
  channels: CrmChannelType[];
  status: CampaignStatus;
  scheduled_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignContentType = "post" | "caption" | "whatsapp_message" | "ad" | "story" | "title" | "cta";
export type ContentOrigin = "manual" | "ai";

export interface MarketingCampaignContent {
  id: string;
  campaign_id: string;
  channel: CrmChannelType | null;
  content_type: CampaignContentType;
  body: string;
  media_url: string | null;
  generated_by: ContentOrigin;
  created_by: string | null;
  created_at: string;
}

export type SegmentConditionType = "purchased_last_days" | "inactive_days" | "category_id" | "min_total_spent" | "lead_source";

export interface MarketingSegment {
  id: string;
  company_id: string;
  name: string;
  condition_type: SegmentConditionType;
  condition_value: Record<string, unknown>;
  created_at: string;
}

export type MarketingCreditAction = "image" | "video" | "content" | "campaign";

export interface MarketingCreditCost {
  action_type: MarketingCreditAction;
  credits_cost: number;
}

export interface MarketingCredits {
  company_id: string;
  balance: number;
  resets_at: string;
}

export type MarketingCreditReference = "campaign" | "campaign_content";

export interface MarketingCreditUsage {
  id: string;
  company_id: string;
  action_type: MarketingCreditAction;
  credits_spent: number;
  reference_type: MarketingCreditReference | null;
  reference_id: string | null;
  created_at: string;
}
