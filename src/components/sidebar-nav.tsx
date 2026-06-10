"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, MapPin, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/mapa", label: "Mapa", icon: MapPin },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegación de la barra lateral (pantallas grandes, sobre fondo navy). */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((it) => {
        const Icon = it.icon;
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Navegación horizontal para móviles (bajo la cabecera). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-card flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden">
      {NAV_ITEMS.map((it) => {
        const Icon = it.icon;
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
