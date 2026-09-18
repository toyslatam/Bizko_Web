"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerFullName } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import type { Company, Customer, Sale, SaleItem } from "@/types/database";

/**
 * Comprobante de venta en formato ticket de 80 mm.
 *
 * No es una factura electrónica: no lleva CUFE ni validación DIAN, así que no
 * reemplaza la facturación legal. Es el papel que se le entrega al cliente en
 * el mostrador y el respaldo interno de la venta.
 */
export function SaleReceipt({
  company,
  sale,
  items,
  customer,
}: {
  company: Company;
  sale: Sale;
  items: SaleItem[];
  customer: Customer | null;
}) {
  const date = new Date(sale.created_at).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full max-w-lg p-6">
      {/*
        El ancho del ticket se fija en 72 mm de contenido dentro de un rollo de
        80 mm. `@page { margin: 0 }` evita que el navegador imprima su propio
        encabezado con la fecha y la URL.
      */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          .no-print { display: none !important; }
          .receipt {
            width: 72mm;
            margin: 0;
            padding: 4mm 0;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            font-size: 11px;
          }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/ventas/${sale.id}`}>
            <ArrowLeft /> Volver a la venta
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </div>

      <div className="receipt mx-auto w-[72mm] rounded-lg border border-border bg-card p-4 font-mono text-[11px] leading-snug text-foreground">
        <div className="text-center">
          <p className="font-heading text-sm font-bold uppercase">{company.name}</p>
          {company.address && <p>{company.address}</p>}
          {company.city && <p>{company.city}</p>}
          {company.phone && <p>Tel. {company.phone}</p>}
        </div>

        <Separator />

        <div className="flex justify-between">
          <span>Comprobante</span>
          <span className="font-semibold"># {sale.sale_number}</span>
        </div>
        <div className="flex justify-between">
          <span>Fecha</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>Cliente</span>
          <span className="max-w-[40mm] truncate text-right">
            {customer ? customerFullName(customer) : "Cliente general"}
          </span>
        </div>

        <Separator />

        {items.map((item) => (
          <div key={item.id} className="mb-1.5">
            <p className="truncate">{item.name}</p>
            <div className="flex justify-between">
              <span>
                {item.quantity} x {formatCurrencyCents(item.unit_price_cents)}
              </span>
              <span>{formatCurrencyCents(item.total_cents)}</span>
            </div>
            {item.modifiers.map((modifier) => (
              <div key={modifier.name} className="flex justify-between pl-2 opacity-80">
                <span className="truncate">+ {modifier.name}</span>
                <span>{formatCurrencyCents(modifier.price_cents)}</span>
              </div>
            ))}
            {item.discount_cents > 0 && (
              <div className="flex justify-between pl-2 opacity-80">
                <span>Descuento</span>
                <span>-{formatCurrencyCents(item.discount_cents)}</span>
              </div>
            )}
          </div>
        ))}

        <Separator />

        <Row label="Subtotal" value={formatCurrencyCents(sale.subtotal_cents)} />
        {sale.discount_cents > 0 && (
          <Row label="Descuento" value={`-${formatCurrencyCents(sale.discount_cents)}`} />
        )}
        {sale.tax_cents > 0 && <Row label="Impuesto" value={formatCurrencyCents(sale.tax_cents)} />}

        <div className="mt-1 flex justify-between border-t border-dashed border-foreground/40 pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatCurrencyCents(sale.total_cents)}</span>
        </div>

        <Row label="Pago" value={PAYMENT_METHOD_LABELS[sale.payment_method]} />

        {sale.status === "voided" && (
          <p className="mt-2 text-center font-bold uppercase">*** Venta anulada ***</p>
        )}

        {sale.notes && <p className="mt-2 break-words opacity-80">{sale.notes}</p>}

        <Separator />

        <p className="text-center">¡Gracias por tu compra!</p>
        <p className="mt-1 text-center opacity-70">
          Este documento no es una factura electrónica.
        </p>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="my-2 border-t border-dashed border-foreground/40" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
