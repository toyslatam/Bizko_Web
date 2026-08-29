const COP_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/** Formatea centavos (ej. 84200000 -> "$ 842.000"). */
export function formatCurrencyCents(cents: number): string {
  return COP_FORMATTER.format(cents / 100);
}

/** Formatea centavos de dólar (ej. 500 -> "$5.00"). */
export function formatUsdCents(cents: number): string {
  return USD_FORMATTER.format(cents / 100);
}

/**
 * Tasa referencial USD → COP para mostrar un estimado junto al precio en
 * dólares de los planes de bizko (Fase 11 §26 — precios sin cobro activo
 * todavía, esta conversión es solo informativa). Ajustar aquí cuando cambie
 * la tasa de referencia; no depende de un proveedor de pagos.
 */
export const USD_TO_COP_RATE = 4000;

/** Convierte centavos de USD a un estimado de pesos colombianos (ej. "$20.000 COP aprox."). */
export function formatUsdCentsAsCop(usdCents: number): string {
  const copValue = (usdCents / 100) * USD_TO_COP_RATE;
  return `${COP_FORMATTER.format(copValue)} COP aprox.`;
}

/** Rango de precio de un set de variantes — "$50.000" si todas cuestan igual, "$50.000 - $80.000" si no. */
export function formatVariantPriceRange(variants: { price_cents: number }[]): string {
  if (variants.length === 0) return "Consultar precio";
  const prices = variants.map((v) => v.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatCurrencyCents(min) : `${formatCurrencyCents(min)} - ${formatCurrencyCents(max)}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
