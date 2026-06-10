import { Home } from "lucide-react";

import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Marco de la aplicación tras iniciar sesión: barra lateral navy (240px) y
 * cabecera (56px), replicando la apariencia de la v1.
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
      {/* Barra lateral (solo en pantallas medianas o más grandes) */}
      <aside className="bg-navy-dark fixed inset-y-0 left-0 hidden w-60 flex-col md:flex">
        <div className="flex h-14 items-center px-5">
          <Brand tone="light" />
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4">
          <span className="flex items-center gap-3 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white">
            <Home className="size-4" aria-hidden />
            Inicio
          </span>
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-white/50">
          Serfuplagas Ltda.
        </div>
      </aside>

      {/* Zona de contenido */}
      <div className="md:pl-60">
        <header className="bg-card flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="md:hidden">
              <Brand />
            </span>
            <span className="text-muted-foreground hidden text-sm md:inline">
              {tenantName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{userName}</p>
              <p className="text-muted-foreground text-xs leading-tight">
                {roleLabel}
              </p>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
