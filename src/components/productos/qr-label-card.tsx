"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { formatCurrencyCents } from "@/lib/format";
import type { QrLabel } from "@/lib/qr";

/** Una etiqueta: foto, QR, nombre, característica y precio. */
export function QrLabelCard({ label, size = 132 }: { label: QrLabel; size?: number }) {
  return (
    <div className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
      {label.imageUrl && (
        <Image
          src={label.imageUrl}
          alt={label.detail ? `${label.name} ${label.detail}` : label.name}
          width={64}
          height={64}
          className="size-16 rounded-md object-cover"
        />
      )}

      {label.href ? (
        <QRCodeSVG value={label.href} size={size} level="M" marginSize={1} />
      ) : (
        // Reserva el espacio hasta que el cliente conozca el origin, para que
        // la etiqueta no salte al montar.
        <div
          className="flex items-center justify-center text-muted-foreground"
          style={{ width: size, height: size }}
        >
          <QrCode className="size-8" />
        </div>
      )}

      <p className="text-sm font-medium text-foreground">{label.name}</p>
      {label.detail && <p className="text-xs text-muted-foreground">{label.detail}</p>}
      <p className="font-heading text-lg font-semibold text-foreground">
        {formatCurrencyCents(label.priceCents)}
      </p>
    </div>
  );
}
