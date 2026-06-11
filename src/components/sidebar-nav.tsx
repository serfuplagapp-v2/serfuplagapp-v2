"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  HardHat,
  LayoutTemplate,
  Mail,
  MapPin,
  Navigation,
  Package,
  Receipt,
  Settings,
  SprayCan,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Menú lateral: réplica de la v1 (core/app.js GRUPOS_ADMIN + redesign.css).
 * 4 secciones, item activo con borde izquierdo amarillo #FFD43B sobre navy.
 * "Mapa" es un extra de la v2 (en la v1 el mapa vive dentro de Agenda Op.).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/pendientes", label: "Pendientes", icon: CheckSquare },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/mapa", label: "Mapa", icon: MapPin },
      { href: "/crm", label: "CRM", icon: Trophy },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/ordenes", label: "Órdenes", icon: ClipboardList },
      { href: "/agenda/ruta", label: "Agenda Op.", icon: Navigation },
      { href: "/terreno", label: "Terreno", icon: SprayCan },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/layouts", label: "Layouts", icon: LayoutTemplate },
      { href: "/comercial", label: "Facturación", icon: Receipt },
      { href: "/ordenes-compra", label: "Órdenes de Compra", icon: FileText },
      { href: "/tecnicos", label: "RR.HH.", icon: HardHat },
      { href: "/stock", label: "Stock", icon: Package },
      { href: "/casos-especiales", label: "Casos Especiales", icon: Star },
      { href: "/plantillas", label: "Plantillas", icon: Mail },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * El item activo es el de coincidencia MÁS LARGA con la ruta actual, para que
 * /agenda/ruta encienda "Agenda Op." y no "Agenda".
 */
function useActiveHref(): string | null {
  const pathname = usePathname();
  let best: string | null = null;
  for (const it of ALL_ITEMS) {
    if (pathname === it.href || pathname.startsWith(`${it.href}/`)) {
      if (!best || it.href.length > best.length) best = it.href;
    }
  }
  return best;
}

/** Navegación de la barra lateral (pantallas grandes, sobre fondo navy). */
export function SidebarNav() {
  const active = useActiveHref();
  return (
    <nav className="flex flex-col px-2 pb-4">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="px-3 pt-2.5 pb-1 text-[9px] font-bold tracking-[1px] text-white/25 uppercase select-none">
            {g.label}
          </p>
          {g.items.map((it) => {
            const Icon = it.icon;
            const isActive = active === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "my-px flex items-center gap-2.5 rounded-lg border-l-[2.5px] border-transparent px-3 py-2 text-[13px] transition-colors",
                  isActive
                    ? "border-l-[#FFD43B] bg-white/12 font-semibold text-white"
                    : "text-white/55 hover:bg-white/6 hover:text-white/80",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Navegación horizontal para móviles (bajo la cabecera). */
export function MobileNav() {
  const active = useActiveHref();
  return (
    <nav className="bg-card flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden">
      {ALL_ITEMS.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              isActive
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
