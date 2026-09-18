/**
 * Ruta que codifica el QR de un producto. Se resuelve contra el origin del
 * navegador, no contra una variable de entorno, para que el mismo código
 * funcione en producción, en preview y en local.
 */
export function qrPathFor(productId: string, variantId?: string | null): string {
  return variantId ? `/qr/${productId}?v=${variantId}` : `/qr/${productId}`;
}
