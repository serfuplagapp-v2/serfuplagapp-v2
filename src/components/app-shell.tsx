import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";

/**
 * Marco de la aplicación tras iniciar sesión, replicando el rediseño de la v1
 * (redesign.css v2026.05): cabecera navy oscuro #122850 de 56px y barra
 * lateral navy #1B3A6B de 240px con el menú agrupado.
 */
export function AppShell({
  children,
  userName,
  tenantName,
  roleLabel,
}: {
  children: React.ReactNode;
  userName: string;
  tenantName: string;
  roleLabel: string;
}) {
  return (
    <div className="bg-background min-h-svh">
      {/* Cabecera (navy oscuro, como la v1) */}
      <header className="bg-navy-dark fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between gap-4 px-4 shadow-[0_1px_0_rgba(0,0,0,.28)] md:px-5">
        <div className="flex items-center gap-3">
          <Brand tone="light" />
          <span className="hidden border-l border-white/10 pl-3 text-sm text-white/60 md:inline">
            {tenantName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-medium text-white/90">{userName}</p>
            <p className="text-xs leading-tight text-white/50">{roleLabel}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Barra lateral (solo en pantallas medianas o más grandes) */}
      <aside className="bg-navy fixed top-14 bottom-0 left-0 hidden w-60 flex-col overflow-y-auto pt-2 md:flex">
        <SidebarNav />
        <div className="mt-auto border-t border-white/10 px-5 py-3 text-[10px] tracking-wide text-white/20">
          {tenantName}
        </div>
      </aside>

      {/* Zona de contenido */}
      <div className="pt-14 md:pl-60">
        <MobileNav />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
