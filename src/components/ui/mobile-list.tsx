import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col divide-y divide-border md:hidden", className)}>
      {children}
    </div>
  );
}

interface MobileListItemProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Fila de MobileList. Reemplaza filas de tabla en pantallas pequeñas
 * (ver principio "tablas grandes -> cards en móvil").
 */
export function MobileListItem({
  title,
  subtitle,
  trailing,
  leading,
  href,
  onClick,
  className,
}: MobileListItemProps) {
  const navigable = Boolean(href || onClick);
  const rowClassName = cn(
    "flex w-full items-center gap-3 py-3 text-left",
    navigable && "active:opacity-70",
    className,
  );
  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {trailing}
      {navigable && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={rowClassName}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClassName}>
        {content}
      </button>
    );
  }
  return <div className={rowClassName}>{content}</div>;
}
